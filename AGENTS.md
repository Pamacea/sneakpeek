# Repository Guidelines

## Project Structure & Module Organization

- `src/cli/` is the CLI entrypoint; `src/tui/` contains the Ink-based TUI.
- `src/core/` holds filesystem operations and variant management; `src/providers/` defines provider templates; `src/brands/` stores tweakcc brand presets.
- `test/` contains Node test files named `*.test.ts`.
- `scripts/` includes build helpers (bundle, SVG render, legacy shell script).
- `docs/` holds documentation assets; `dist/` is generated output (do not edit by hand).
- `repos/` contains upstream mirrors used by docs/prompt-pack work; treat as vendor data unless you are updating upstream references.

## Build, Test, and Development Commands

- `npm install` installs dependencies.
- `npm run dev` runs the CLI from TypeScript sources (`src/cli/index.ts`).
- `npm run tui` launches the full-screen TUI wizard.
- `npm run bundle` builds `dist/cc-mirror.mjs` (also executed by `npm run prepack`).
- `npm run render:tui-svg` regenerates `docs/cc-mirror-tree.svg` from the TUI snapshot.
- `npm test` runs the Node test runner with `tsx`.
- `npm run typecheck` performs a strict TypeScript check without emitting files.

## Coding Style & Naming Conventions

- TypeScript + ESM (`"type": "module"`); use `import`/`export` and avoid CommonJS.
- Match existing formatting: 2-space indentation, single quotes, semicolons.
- Name tests as `*.test.ts`; keep new files in the relevant `src/<area>/` folder.

## Testing Guidelines

- Tests use Node’s built-in test runner (`node --test`) and `tsx` for TS execution.
- Place new tests in `test/` and name them after the feature (`providers.test.ts`, `tui.test.ts`).
- No explicit coverage threshold is defined; add tests for new provider templates, TUI flows, and core file operations.

## Commit & Pull Request Guidelines

- No Git history is available in this workspace (no `.git`), so there is no established commit convention. Use clear, imperative subjects (e.g., “Add OpenRouter defaults”) and keep the first line ≤72 characters.
- PRs should include a concise summary and verification steps (e.g., `npm test`, `npm run tui`).
- Include screenshots or re-run `npm run render:tui-svg` when TUI output changes.
- Call out any edits to `repos/` and why they are necessary.

## Security & Configuration Tips

- API keys and base URLs should stay in user config (`settings.json`) or env vars; do not hard-code secrets in the repo.
- If you change the on-disk variant layout, update `README.md` and `DESIGN.md` accordingly.

## Runtime Layout & Config Flow (Quick Reference)

- Variant root: `~/.cc-mirror/<variant>/`
  - `config/settings.json`: env overrides (API keys, base URLs, model defaults)
  - `config/.claude.json`: API-key approvals + onboarding/theme + MCP server entries
  - `tweakcc/config.json`: brand preset + theme list
  - `tweakcc/system-prompts/`: prompt-pack overlays (after tweakcc apply)
  - `variant.json`: metadata for listing/updates
- Wrapper: `~/.local/bin/<variant>`
  - Sets `CLAUDE_CONFIG_DIR`
  - Loads `settings.json` into env at runtime
  - Shows provider splash ASCII art when TTY and `CC_MIRROR_SPLASH != 0`
  - Auto-update disable uses `DISABLE_AUTOUPDATER=1` in `config/settings.json` (env)
- Install: npm-only, pinned to `@anthropic-ai/claude-code@2.0.76`
- Provider auth:
  - API-key providers (Zai Cloud, MiniMax Cloud, Custom) use `ANTHROPIC_API_KEY`.
  - Auth-token providers (OpenRouter, Local LLMs) use `ANTHROPIC_AUTH_TOKEN`.
  - Local LLMs allow blank keys; cc-mirror injects a placeholder token (`local-llm`) so Claude Code starts.
  - Wrappers unset `ANTHROPIC_AUTH_TOKEN` only when `CC_MIRROR_UNSET_AUTH_TOKEN=1` (API-key variants).
- Model mapping (aliases used by `/model`):
  - `ANTHROPIC_DEFAULT_SONNET_MODEL`
  - `ANTHROPIC_DEFAULT_OPUS_MODEL`
  - `ANTHROPIC_DEFAULT_HAIKU_MODEL`
  - Optional: `ANTHROPIC_SMALL_FAST_MODEL`, `ANTHROPIC_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL`

## Debugging & Verification

- Quick sanity: `cc-mirror doctor`
- Confirm config values:
  - `~/.cc-mirror/<variant>/config/settings.json`
  - `~/.cc-mirror/<variant>/config/.claude.json`
  - `~/.cc-mirror/<variant>/variant.json`
- Confirm tweakcc:
  - `~/.cc-mirror/<variant>/tweakcc/config.json`
  - `~/.cc-mirror/<variant>/tweakcc/system-prompts/` (prompt packs)
- Wrapper inspection: `~/.local/bin/<variant>`
- Claude Code CLI path (npm installs):
  - `~/.cc-mirror/<variant>/npm/node_modules/@anthropic-ai/claude-code/cli.js`
- Upstream CLI reference (pinned copy):
  - `repos/anthropic-claude-code-2.0.76/package/cli.js`
- Debug logs (runtime): `~/.cc-mirror/<variant>/config/debug/*.txt`
- Prompt suggestions: force-enable with `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=1` in `config/settings.json` (env)
- CLI feature gates (prompt suggestions, statsig, etc.):
  - Use `rg` on `~/.cc-mirror/<variant>/npm/node_modules/@anthropic-ai/claude-code/cli.js` for keys like `tengu_prompt_suggestion`, `promptSuggestionEnabled`, `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION`.
  - Check `~/.cc-mirror/<variant>/config/.claude.json` for cached gates and settings.
- Prompt sources live in `repos/claude-code-system-prompts/system-prompts/` and applied versions in `~/.cc-mirror/<variant>/tweakcc/system-prompts/`.

## ZAI CLI (optional tooling)

- Show CLI help: `npx zai-cli --help` (subcommands: `vision`, `search`, `read`, `repo`, `tools`, `tool`, `call`, `code`, `doctor`)
- Each subcommand supports `--help` for flags and examples.
- Requires `Z_AI_API_KEY` in the environment or shell profile.

## Common Tasks

- Add/update a provider template: `src/providers/index.ts`
- Add/update brand presets (themes/appearance): `src/brands/*`
- Prompt packs & overlays: `src/core/prompt-pack.ts` (entry) + `src/core/prompt-pack/*` (providers/overlays/targets). Overlays are sanitized to strip backticks to avoid tweakcc template literal issues.
- Shell env policy (Z.ai only): `src/core/shell-env.ts`
- TUI screens: `src/tui/screens/*` and UI components in `src/tui/components/ui/*`
- Core create/update logic: `src/core/index.ts`

## Manual Debug Flow (Create Variant)

1. Run: `npm run dev -- create --provider zai --name test-zai --api-key <key>`
2. Verify `variant.json` exists
3. Verify `.claude.json` has `hasCompletedOnboarding` + `theme`
4. Run wrapper in a TTY and confirm splash + no onboarding prompt
5. Use `cc-mirror update test-zai` to validate update flow

## Docs / Sources of Truth

- `README.md` (user-facing)
- `DESIGN.md` (architecture)
- `docs/RECONSTRUCTION-LEDGER.md` (current state + decisions)
- `docs/OPUS-SECOND-PASS.md` (audit brief)
