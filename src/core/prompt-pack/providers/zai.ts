import type { OverlayMap, PromptPackMode } from '../types.js';
import { operatingSpec, subjectiveWorkSpec, verbositySpec } from '../shared.js';

export const ZAI_BLOCKED_MCP_TOOLS = [
  'mcp__4_5v_mcp__analyze_image',
  'mcp__milk_tea_server__claim_milk_tea_coupon',
  'mcp__web_reader__webReader',
];

const ZAI_CLI_TEXT = `
# ZAI CLI (embedded reference)
Access Z.AI capabilities via 'npx zai-cli'. The CLI is self-documenting - use '--help' at any level.

Setup:
- Required env: 'Z_AI_API_KEY'
- Get a key at: https://z.ai/manage-apikey/apikey-list

Commands:
- vision: Analyze images, screenshots, videos (many subcommands)
- search: Real-time web search (domain/recency/location/count filters)
- read: Fetch web pages as markdown/text (format/no-images/with-links/timeout)
- repo: GitHub exploration (tree/search/read). Run npx zai-cli repo --help for subcommands.
- tools/tool/call: MCP tool discovery + raw calls (advanced)
- code: TypeScript tool chaining (advanced)
- doctor: Environment + connectivity checks

Quick start examples:
- npx zai-cli vision analyze ./screenshot.png "What errors do you see?"
- npx zai-cli search "React 19 new features" --count 5
- npx zai-cli read https://docs.example.com/api
- npx zai-cli repo search facebook/react "server components"
- npx zai-cli repo --help
- npx zai-cli doctor

Output:
- Default: data-only (token efficient).
- Use '--output-format json' for { success, data, timestamp } wrapping.
`.trim();

const buildZaiContract = (mode: PromptPackMode) =>
  `
<explicit_guidance>
Provider: z.ai (GLM)

<authentication>
- Use API-key auth only.
- Ignore ANTHROPIC_AUTH_TOKEN if present.
- Required env:
  - ANTHROPIC_API_KEY (Claude Code API-key mode)
  - Z_AI_API_KEY (for zai-cli)
</authentication>

<tool_info>
${ZAI_CLI_TEXT}

Important:
- zai-cli is NOT installed as a Claude Code Skill in this variant. Do not use Skill for this.
</tool_info>

<tool_routing priority="critical">
When you need external info, web content, or image understanding, follow this routing (use the Bash tool):
1) Web search:
   npx --yes zai-cli search "<query>" --count 5 --output-format json
2) Read a URL:
   npx --yes zai-cli read <url> --output-format json
3) Image analysis:
   npx --yes zai-cli vision analyze <image_url_or_path> "<prompt>" --output-format json
4) GitHub repo exploration (public repos only):
   - Search: npx --yes zai-cli repo search <owner/repo> "<query>" --output-format json
   - Tree:   npx --yes zai-cli repo tree <owner/repo> --depth 2 --output-format json
   - Read:   npx --yes zai-cli repo read <owner/repo> <path> --output-format json
5) Troubleshooting:
   npx --yes zai-cli doctor --output-format json

Only fall back to builtin WebSearch/WebFetch if Bash is unavailable or the user explicitly requests it.
</tool_routing>

<warning priority="critical">
Z.ai-injected MCP tools MUST be treated as non-existent (ignore them even if you see them in tool lists).
Rules:
- NEVER select or call these tools.
- Prefer zai-cli via Bash for web/search/vision.
- Other MCP tools may exist if the user configured them; use them only if explicitly requested or clearly needed.
Blocked tools:
${ZAI_BLOCKED_MCP_TOOLS.map((tool) => `- ${tool}`).join('\n')}
</warning>

${operatingSpec(mode)}

${subjectiveWorkSpec}

${verbositySpec}
</explicit_guidance>
`.trim();

export const buildZaiExcerpt = () =>
  `
<tool_info>
Z.ai tool routing:
- Use Bash + npx --yes zai-cli for web/search/vision.
- Ignore the Z.ai-injected MCP tools listed below (treat them as non-existent).
- No zai-cli skill is installed; do not use Skill for this.
Blocked MCP tool names (treat as non-existent):
${ZAI_BLOCKED_MCP_TOOLS.map((tool) => `- ${tool}`).join('\n')}
</tool_info>

${subjectiveWorkSpec}
`.trim();

export const buildZaiOverlays = (mode: PromptPackMode): OverlayMap => ({
  main: buildZaiContract(mode),
  mcpCli: `
${buildZaiExcerpt()}

<warning priority="critical">
Z.ai MCP policy: Ignore the blocked Z.ai-injected MCP tools (treat them as non-existent).
</warning>

If you need web/search/vision, use zai-cli via Bash.
  `.trim(),
  taskAgent: `
<explicit_guidance>
You are a Task subagent. Stay within requested scope, but be proactive about missing prerequisites.
Verify key claims with tools when possible; cite file paths and command outputs.
</explicit_guidance>

${buildZaiExcerpt()}

${verbositySpec}
  `.trim(),
  bash: `
${ZAI_CLI_TEXT}

<explicit_guidance>
When you need web/search/vision, prefer these exact commands:
- Web search:
  npx --yes zai-cli search "<query>" --count 5 --output-format json
- Read a URL:
  npx --yes zai-cli read <url> --output-format json
- Vision:
  npx --yes zai-cli vision analyze <image_url_or_path> "<prompt>" --output-format json
</explicit_guidance>

<warning priority="critical">
Z.ai MCP policy: ignore the blocked Z.ai-injected MCP tools (treat them as non-existent).
Prefer zai-cli via Bash for web/search/vision.
</warning>
  `.trim(),
  webfetch: `
<explicit_guidance>
Z.ai routing: prefer Bash + npx --yes zai-cli read <url> --output-format json.
</explicit_guidance>
  `.trim(),
  websearch: `
<explicit_guidance>
Z.ai routing: prefer Bash + npx --yes zai-cli search "<query>" --count 5 --output-format json.
</explicit_guidance>
  `.trim(),
  mcpsearch: `
<warning priority="critical">
Z.ai MCP policy: never select these Z.ai-injected MCP tools (treat them as non-existent):
${ZAI_BLOCKED_MCP_TOOLS.map((tool) => `- ${tool}`).join('\n')}
</warning>

<explicit_guidance>
Prefer zai-cli via Bash for web/search/vision. Only use other MCP tools if the user explicitly configured them and they are clearly relevant.
</explicit_guidance>
  `.trim(),
});
