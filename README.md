# claude-sneakpeek

A fork of [cc-mirror](https://github.com/anthropics/cc-mirror) that unlocks feature-flagged capabilities in Claude Code.

## Install

```bash
npx @realmikekelly/claude-sneakpeek quick --name claudesp
```

Run `claudesp` to launch Claude Code with unreleased features enabled.

## What does it do?

claude-sneakpeek installs Claude Code and patches it to enable features that are built but not yet publicly released. Currently this includes:

- **Swarm mode** — Native multi-agent orchestration with the `TeammateTool`
- **Delegate mode** — Task tool can spawn agents in delegate mode
- **Team coordination** — Teammate mailbox/messaging and task ownership

Your main Claude Code installation stays untouched. Each sneakpeek variant is fully isolated with its own config, sessions, and credentials.

## Commands

```bash
npx @realmikekelly/claude-sneakpeek quick --name claudesp   # Install
npx @realmikekelly/claude-sneakpeek update claudesp         # Update to latest
npx @realmikekelly/claude-sneakpeek remove claudesp         # Uninstall

claudesp                                                     # Run it
```

## How it works

```
~/.claude-sneakpeek/
└── claudesp/
    ├── npm/               Claude Code installation (patched)
    ├── config/            API keys, sessions, MCP servers
    └── variant.json       Metadata

~/.local/bin/claudesp      Wrapper script
```

The wrapper is added to `~/.local/bin` (macOS/Linux) or `~/.claude-sneakpeek/bin` (Windows).

## Alternative providers

claude-sneakpeek also supports alternative API providers (Z.ai, MiniMax, OpenRouter, etc.) inherited from cc-mirror. See [providers.md](docs/providers.md) for details.

## Related

- [cc-mirror](https://github.com/anthropics/cc-mirror) — The upstream project
- [tweakcc](https://github.com/Piebald-AI/tweakcc) — Theme customization for Claude Code

## License

MIT
