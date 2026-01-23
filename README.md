# claude-sneakpeek

Isolated Claude Code installations with custom providers and themes.

## Install

```bash
npx claude-sneakpeek quick --provider mirror --name claudesp
```

That's it. Now run `claudesp` to launch your isolated Claude Code.

---

## What is claude-sneakpeek?

claude-sneakpeek creates isolated Claude Code installations. Each variant has its own config, sessions, MCP servers, and credentials. Your main Claude Code stays untouched.

```
~/.claude-sneakpeek/
├── claudesp/              ← Your variant
│   ├── npm/               Claude Code installation
│   ├── config/            API keys, sessions, MCP servers
│   ├── tweakcc/           Theme customization
│   └── variant.json       Metadata
├── zai/                   ← Another variant (optional)
└── minimax/               ← Another variant (optional)

Wrapper: ~/.local/bin/claudesp
```

The wrapper command (`claudesp`) is added to `~/.local/bin` (macOS/Linux) or `~/.claude-sneakpeek/bin` (Windows).

---

## Providers

### Mirror (default)

Uses the standard Anthropic API. Authenticate normally via OAuth or API key.

```bash
npx claude-sneakpeek quick --provider mirror --name claudesp
```

### Alternative Providers

Use different model providers:

| Provider       | Models                 | Auth       | Best For                        |
| -------------- | ---------------------- | ---------- | ------------------------------- |
| **Z.ai**       | GLM-4.7, GLM-4.5-Air   | API Key    | Heavy coding with GLM reasoning |
| **MiniMax**    | MiniMax-M2.1           | API Key    | Unified model experience        |
| **OpenRouter** | 100+ models            | Auth Token | Model flexibility, pay-per-use  |
| **CCRouter**   | Ollama, DeepSeek, etc. | Optional   | Local-first development         |

```bash
# Z.ai (GLM Coding Plan)
npx claude-sneakpeek quick --provider zai --api-key "$Z_AI_API_KEY"

# MiniMax (MiniMax-M2.1)
npx claude-sneakpeek quick --provider minimax --api-key "$MINIMAX_API_KEY"

# OpenRouter (100+ models)
npx claude-sneakpeek quick --provider openrouter --api-key "$OPENROUTER_API_KEY" \
  --model-sonnet "anthropic/claude-sonnet-4-20250514"

# Claude Code Router (local LLMs)
npx claude-sneakpeek quick --provider ccrouter
```

---

## Commands

```bash
npx claude-sneakpeek                     # Interactive TUI
npx claude-sneakpeek quick [options]     # Fast setup
npx claude-sneakpeek list                # List variants
npx claude-sneakpeek update [name]       # Update variant(s)
npx claude-sneakpeek remove <name>       # Delete a variant
npx claude-sneakpeek doctor              # Health check

# Run your variant
claudesp
```

---

## CLI Options

```
--provider <name>        mirror | zai | minimax | openrouter | ccrouter | custom
--name <name>            Variant name (becomes the CLI command)
--api-key <key>          Provider API key
--base-url <url>         Custom API endpoint
--model-sonnet <name>    Map to sonnet model
--model-opus <name>      Map to opus model
--model-haiku <name>     Map to haiku model
--brand <preset>         Theme: auto | zai | minimax | openrouter | ccrouter | mirror
--no-tweak               Skip tweakcc theme
--no-prompt-pack         Skip provider prompt pack
--verbose               Show full tweakcc output during update
```

---

## Brand Themes

Each provider includes a custom color theme via [tweakcc](https://github.com/Piebald-AI/tweakcc):

| Brand          | Style                            |
| -------------- | -------------------------------- |
| **mirror**     | Silver/chrome with electric blue |
| **zai**        | Dark carbon with gold accents    |
| **minimax**    | Coral/red/orange spectrum        |
| **openrouter** | Teal/cyan gradient               |
| **ccrouter**   | Sky blue accents                 |

---

## Documentation

- [Mirror Claude](docs/features/mirror-claude.md) — Using the mirror provider
- [Architecture](docs/architecture/overview.md) — How it works

---

## Related Projects

- [tweakcc](https://github.com/Piebald-AI/tweakcc) — Theme and customize Claude Code
- [Claude Code Router](https://github.com/musistudio/claude-code-router) — Route Claude Code to any LLM

---

## License

MIT
