# sneakpeek

Get a parallel build of Claude Code that unlocks feature-flagged capabilities like swarm mode.

Demo video of swarm mode in action: https://x.com/NicerInPerson/status/2014989679796347375

This installs a completely isolated instance of Claude Code—separate config, sessions, MCP servers, and credentials. Your existing Claude Code installation is untouched.

## Install

```bash
npx @oalacea/sneakpeek quick --name claudesp
```

Add `~/.local/bin` to your PATH if not already (macOS/Linux):

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

Then run `claudesp` to launch.

### Windows

On Windows, wrappers are installed to `~/.claude-sneakpeek/bin/` by default. Add this directory to your PATH:

```powershell
# In PowerShell, add to user PATH (one-time)
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$claudePath = "$env:USERPROFILE\.claude-sneakpeek\bin"
if ($userPath -notlike "*$claudePath*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$claudePath", "User")
}
```

Then restart your terminal and run:

```powershell
claudesp  # or claudesp.cmd
```

**Windows Shell Support:**
- **PowerShell** (5 or 7) - Fully supported for Z.ai environment setup
- **Git Bash** - Supported if installed
- **Command Prompt (cmd)** - Works but requires manual env var configuration

For Z.ai API key setup on PowerShell, the tool will automatically configure your PowerShell profile. If you prefer manual setup, add to your `$PROFILE`:

```powershell
# claude-sneakpeek: Z.ai env start
$env:Z_AI_API_KEY="your-key-here"
# claude-sneakpeek: Z.ai env end
```

## What gets unlocked?

Features that are built into Claude Code but not yet publicly released:

- **Swarm mode** — Native multi-agent orchestration with `TeammateTool`
- **Delegate mode** — Task tool can spawn background agents
- **Team coordination** — Teammate messaging and task ownership

## Commands

```bash
npx @oalacea/sneakpeek quick --name claudesp   # Install
npx @oalacea/sneakpeek update claudesp         # Update
npx @oalacea/sneakpeek remove claudesp         # Uninstall
```

## Where things live

```
~/.claude-sneakpeek/claudesp/
├── npm/           # Patched Claude Code
├── config/        # Isolated config, sessions, MCP servers
└── variant.json

~/.local/bin/claudesp   # Wrapper script
```

## Alternative providers

Supports Z.ai, MiniMax, OpenRouter, and local models via cc-mirror. See [docs/providers.md](docs/providers.md).

## Credits

Fork of [cc-mirror](https://github.com/numman-ali/cc-mirror) by Numman Ali.

## License

MIT
