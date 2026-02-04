#!/usr/bin/env node
/**
 * Cross-platform variant management tools
 * Replaces shell scripts with Node.js CLI for Windows/macOS/Linux compatibility
 *
 * Usage:
 *   node scripts/variant-tools.ts build-variants [options]
 *   node scripts/variant-tools.ts enable-team-mode [variant-name]
 *   node scripts/variant-tools.ts list-variants
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// ============================================================================
// Types & Constants
// ============================================================================

const isWindows = process.platform === 'win32';

interface BuildVariantsOptions {
  rootDir?: string;
  binDir?: string;
  claudeOrig?: string;
  zaiBaseUrl?: string;
  zaiApiKey?: string;
  minimaxBaseUrl?: string;
  minimaxApiKey?: string;
  timeoutMs?: string;
}

interface VariantInfo {
  name: string;
  dir: string;
  configDir: string;
  cliPath: string;
  hasBinary: boolean;
  hasConfig: boolean;
}

const DEFAULT_ROOT_DIR = path.join(os.homedir(), '.cc-mirror');
const DEFAULT_BIN_DIR = isWindows
  ? path.join(os.homedir(), '.claude-sneakpeek', 'bin')
  : path.join(os.homedir(), '.local', 'bin');
const ZAI_DEFAULT_BASE_URL = 'https://api.z.ai/api/anthropic';
const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimax.io/anthropic';
const DEFAULT_TIMEOUT_MS = '3000000';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Validate that a path is within allowed boundaries and doesn't escape via symlinks
 * Returns null if valid, error message otherwise
 */
const validatePath = (targetPath: string, allowedRoot?: string): string | null => {
  try {
    const resolved = fs.realpathSync(targetPath);
    const normalized = path.normalize(targetPath);

    // Check for obvious path traversal attempts
    if (normalized.includes('..')) {
      return `Path contains parent directory reference: ${targetPath}`;
    }

    // If allowed root specified, ensure resolved path is within it
    if (allowedRoot) {
      const resolvedRoot = fs.realpathSync(allowedRoot);
      if (!resolved.startsWith(resolvedRoot)) {
        return `Path is outside allowed root: ${targetPath}`;
      }
    }

    return null;
  } catch {
    // Path doesn't exist yet, do basic string validation
    const normalized = path.normalize(targetPath);
    if (normalized.includes('..')) {
      return `Path contains parent directory reference: ${targetPath}`;
    }
    return null;
  }
};

/**
 * Verify that a file is a valid Node.js executable
 * Checks shebang and basic file properties
 */
const verifyNodeExecutable = (filePath: string): { ok: boolean; message?: string } => {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return { ok: false, message: `Not a regular file: ${filePath}` };
    }

    // Check first line for shebang
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(256);
    fs.readSync(fd, buffer, 0, 256, 0);
    fs.closeSync(fd);

    const firstLine = buffer.toString('utf8', 0, buffer.indexOf('\n'));
    if (!firstLine.startsWith('#!')) {
      return { ok: false, message: 'Missing shebang, not a valid executable' };
    }

    // Check for node or bash in shebang
    if (!firstLine.includes('node') && !firstLine.includes('bash')) {
      return { ok: false, message: 'Invalid shebang, expected node or bash' };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `File verification failed: ${message}` };
  }
};

const log = {
  info: (msg: string) => console.log(`${COLORS.blue}${msg}${COLORS.reset}`),
  success: (msg: string) => console.log(`${COLORS.green}${msg}${COLORS.reset}`),
  warn: (msg: string) => console.log(`${COLORS.yellow}${msg}${COLORS.reset}`),
  error: (msg: string) => console.error(`${COLORS.red}${msg}${COLORS.reset}`),
  plain: (msg: string) => console.log(msg),
};

const commandExists = (cmd: string): boolean => {
  const result = spawnSync(isWindows ? 'where' : 'which', [cmd], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return result.status === 0 && result.stdout.trim().length > 0;
};

const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const copyFile = (src: string, dest: string): void => {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
};

// ============================================================================
// TweakCC Integration
// ============================================================================

interface TweakccOptions {
  tweakDir: string;
  binPath: string;
}

const findTweakccCmd = (): string[] | null => {
  // Try local node_modules/.bin/tweakcc
  const localTweakcc = path.join(repoRoot, 'node_modules', '.bin', 'tweakcc');
  if (fs.existsSync(localTweakcc)) {
    return [process.execPath, localTweakcc];
  }

  // Try global tweakcc
  if (commandExists('tweakcc')) {
    return ['tweakcc'];
  }

  // Fallback to npx
  if (commandExists('npx')) {
    return ['npx', 'tweakcc@3.2.2'];
  }

  return null;
};

const applyTweakcc = (opts: TweakccOptions): boolean => {
  const tweakccCmd = findTweakccCmd();
  if (!tweakccCmd) {
    log.error('Error: tweakcc not found. Install it or ensure npm/npx is available.');
    return false;
  }

  const env = {
    ...process.env,
    TWEAKCC_CONFIG_DIR: opts.tweakDir,
    TWEAKCC_CC_INSTALLATION_PATH: opts.binPath,
  };

  const result = spawnSync(tweakccCmd[0], tweakccCmd.slice(1), {
    stdio: 'inherit',
    env,
  });

  return result.status === 0;
};

// ============================================================================
// Settings Management
// ============================================================================

interface Settings {
  env?: Record<string, string>;
}

const writeSettings = (
  configDir: string,
  baseUrl: string,
  apiKey: string,
  timeoutMs: string,
  provider: 'zai' | 'minimax'
): void => {
  ensureDir(configDir);

  let settings: Settings;

  if (provider === 'zai') {
    settings = {
      env: {
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_API_KEY: apiKey || '<ZAI_API_KEY>',
        API_TIMEOUT_MS: timeoutMs,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.5-air',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.7',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-4.7',
      },
    };
  } else {
    // minimax
    settings = {
      env: {
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_API_KEY: apiKey || '<MINIMAX_API_KEY>',
        API_TIMEOUT_MS: timeoutMs,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        ANTHROPIC_MODEL: 'MiniMax-M2.1',
        ANTHROPIC_SMALL_FAST_MODEL: 'MiniMax-M2.1',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.1',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M2.1',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M2.1',
      },
    };
  }

  const settingsPath = path.join(configDir, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
};

// ============================================================================
// Wrapper Scripts
// ============================================================================

const writeUnixWrapper = (wrapperPath: string, binPath: string, configDir: string): void => {
  // Use string concatenation to avoid template literal parsing issues with bash syntax
  const shebang = '#!/usr/bin/env bash\n';
  const setPipefail = 'set -euo pipefail\n';
  const exportConfig = 'export CLAUDE_CONFIG_DIR="' + configDir + '"\n';
  const unsetAuth = 'if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then\n  unset ANTHROPIC_AUTH_TOKEN\nfi\n';
  const execCmd = 'exec "' + binPath + '" "$@"\n';

  const content = shebang + setPipefail + exportConfig + unsetAuth + execCmd;
  fs.writeFileSync(wrapperPath, content, { mode: 0o755 });
};

const writeWindowsWrapper = (wrapperPath: string, binPath: string, configDir: string): void => {
  const scriptPath = wrapperPath + '.mjs';
  const cmdPath = wrapperPath + '.cmd';

  const scriptContent = `import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const configDir = ${JSON.stringify(configDir)};
const binaryPath = ${JSON.stringify(binPath)};
const args = process.argv.slice(2);

process.env.CLAUDE_CONFIG_DIR = configDir;

const loadSettingsEnv = () => {
  const file = path.join(configDir, 'settings.json');
  try {
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const env = data && typeof data === 'object' ? data.env : null;
    if (env && typeof env === 'object') {
      for (const [key, value] of Object.entries(env)) {
        if (!key) continue;
        process.env[key] = String(value);
      }
    }
  } catch {
    // ignore malformed settings
  }
};
loadSettingsEnv();

if ((process.env.CLAUDE_SNEAKPEEK_UNSET_AUTH_TOKEN || '0') !== '0') {
  delete process.env.ANTHROPIC_AUTH_TOKEN;
}

const result = spawnSync(binaryPath, args, { stdio: 'inherit', env: process.env });
if (typeof result.status === 'number') {
  process.exit(result.status);
}
process.exit(1);
`;

  const cmdContent = `@echo off
setlocal
node "%~dp0${path.basename(scriptPath)}" %*
`;

  fs.writeFileSync(scriptPath, scriptContent);
  fs.writeFileSync(cmdPath, cmdContent.replace(/\n/g, '\r\n'));
};

const writeWrapper = (name: string, binPath: string, configDir: string, binDir: string): void => {
  const wrapperPath = path.join(binDir, name);

  if (isWindows) {
    writeWindowsWrapper(wrapperPath, binPath, configDir);
  } else {
    writeUnixWrapper(wrapperPath, binPath, configDir);
  }
};

// ============================================================================
// Commands
// ============================================================================

/**
 * Build Z.ai and MiniMax variants
 */
const buildVariants = (opts: BuildVariantsOptions = {}): number => {
  const rootDir = opts.rootDir || process.env.CLAUDE_VARIANTS_ROOT || DEFAULT_ROOT_DIR;
  const binDir = opts.binDir || process.env.CLAUDE_VARIANTS_BIN_DIR || DEFAULT_BIN_DIR;

  // Validate paths
  const rootDirError = validatePath(rootDir);
  if (rootDirError) {
    log.error(`Error: Invalid root directory: ${rootDirError}`);
    return 1;
  }
  const binDirError = validatePath(binDir);
  if (binDirError) {
    log.error(`Error: Invalid bin directory: ${binDirError}`);
    return 1;
  }

  // Find Claude binary
  let claudeOrig = opts.claudeOrig || process.env.CLAUDE_ORIG || '';
  if (!claudeOrig) {
    const result = spawnSync('command', ['-v', 'claude'], { shell: true, encoding: 'utf8' });
    if (result.status === 0 && result.stdout.trim()) {
      claudeOrig = result.stdout.trim();
    }
  }

  if (!claudeOrig) {
    log.error("Error: 'claude' not found in PATH and CLAUDE_ORIG not set.");
    return 1;
  }

  if (!fs.existsSync(claudeOrig)) {
    log.error(`Error: CLAUDE_ORIG does not exist: ${claudeOrig}`);
    return 1;
  }

  // Verify the binary is a valid executable
  const verification = verifyNodeExecutable(claudeOrig);
  if (!verification.ok) {
    log.error(`Error: Invalid Claude binary: ${verification.message}`);
    return 1;
  }

  if (!commandExists('node')) {
    log.error('Error: node is required to run tweakcc.');
    return 1;
  }

  const zaiBaseUrl = opts.zaiBaseUrl || process.env.ZAI_BASE_URL || ZAI_DEFAULT_BASE_URL;
  const minimaxBaseUrl = opts.minimaxBaseUrl || process.env.MINIMAX_BASE_URL || MINIMAX_DEFAULT_BASE_URL;
  const zaiApiKey = opts.zaiApiKey || process.env.ZAI_API_KEY || '';
  const minimaxApiKey = opts.minimaxApiKey || process.env.MINIMAX_API_KEY || '';
  const timeoutMs = opts.timeoutMs || process.env.ZAI_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS;

  // Create directories
  ensureDir(rootDir);
  ensureDir(binDir);

  // Setup paths
  const zaiDir = path.join(rootDir, 'zai');
  const minimaxDir = path.join(rootDir, 'minimax');

  const zaiBin = path.join(zaiDir, 'claude');
  const minimaxBin = path.join(minimaxDir, 'claude');

  const zaiConfigDir = path.join(zaiDir, 'config');
  const minimaxConfigDir = path.join(minimaxDir, 'config');

  const zaiTweakDir = path.join(zaiDir, 'tweakcc');
  const minimaxTweakDir = path.join(minimaxDir, 'tweakcc');

  log.info('Building claude-sneakpeek variants...');

  // Copy binaries with verification
  log.plain('Copying binaries...');
  copyFile(claudeOrig, zaiBin);
  copyFile(claudeOrig, minimaxBin);

  // Verify copies
  const zaiVerify = verifyNodeExecutable(zaiBin);
  const minimaxVerify = verifyNodeExecutable(minimaxBin);
  if (!zaiVerify.ok) {
    log.error(`  Z.ai binary verification failed: ${zaiVerify.message}`);
    return 1;
  }
  if (!minimaxVerify.ok) {
    log.error(`  MiniMax binary verification failed: ${minimaxVerify.message}`);
    return 1;
  }
  log.success('  Copied and verified binaries');

  // Write settings
  log.plain('Writing settings...');
  writeSettings(zaiConfigDir, zaiBaseUrl, zaiApiKey, timeoutMs, 'zai');
  writeSettings(minimaxConfigDir, minimaxBaseUrl, minimaxApiKey, timeoutMs, 'minimax');
  log.success('  Wrote settings');

  // Apply tweakcc
  log.plain('Applying tweakcc...');
  const zaiTweakOk = applyTweakcc({ tweakDir: zaiTweakDir, binPath: zaiBin });
  const minimaxTweakOk = applyTweakcc({ tweakDir: minimaxTweakDir, binPath: minimaxBin });

  if (!zaiTweakOk || !minimaxTweakOk) {
    log.error('  Failed to apply tweakcc');
    return 1;
  }
  log.success('  Applied tweakcc');

  // Write wrappers
  log.plain('Writing wrappers...');
  writeWrapper('zai', zaiBin, zaiConfigDir, binDir);
  writeWrapper('minimax', minimaxBin, minimaxConfigDir, binDir);
  log.success('  Wrote wrappers');

  log.success('\nDone!\n');
  log.plain('Binaries:');
  log.plain(`  Z.ai:     ${zaiBin}`);
  log.plain(`  MiniMax:  ${minimaxBin}`);
  log.plain('');
  log.plain('Wrappers:');
  log.plain(`  ${path.join(binDir, 'zai')}`);
  log.plain(`  ${path.join(binDir, 'minimax')}`);
  log.plain('');
  log.warn('Notes:');
  log.plain('  - If ZAI_API_KEY or MINIMAX_API_KEY were not set, placeholder values were written.');
  log.plain('  - Update settings.json in each config dir with your real API keys if needed.');

  return 0;
};

/**
 * List all installed variants
 */
const listVariants = (): number => {
  const rootDir = path.join(os.homedir(), '.claude-sneakpeek');

  if (!fs.existsSync(rootDir)) {
    log.warn('No variants found.');
    log.plain(`Variant directory does not exist: ${rootDir}`);
    return 0;
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const variants: VariantInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dir = path.join(rootDir, entry.name);
    const configDir = path.join(dir, 'config');
    const cliPath = path.join(dir, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');

    let hasConfig = false;
    try {
      if (fs.existsSync(configDir)) {
        const settingsPath = path.join(configDir, 'settings.json');
        hasConfig = fs.existsSync(settingsPath);
      }
    } catch {
      // Ignore config read errors
    }

    variants.push({
      name: entry.name,
      dir,
      configDir,
      cliPath,
      hasBinary: fs.existsSync(cliPath),
      hasConfig,
    });
  }

  if (variants.length === 0) {
    log.warn('No variants found.');
    return 0;
  }

  log.success(`Found ${variants.length} variant(s):\n`);

  for (const v of variants) {
    const status = v.hasBinary ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.red}✗${COLORS.reset}`;
    log.plain(`  ${status} ${v.name}`);
    log.plain(`     Dir: ${v.dir}`);
    if (!v.hasBinary) {
      log.warn('     CLI not installed');
    }
    log.plain('');
  }

  return 0;
};

/**
 * Enable team mode for a variant
 */
const enableTeamMode = (variantName: string): number => {
  const rootDir = path.join(os.homedir(), '.claude-sneakpeek');
  const variantDir = path.join(rootDir, variantName);
  const cliPath = path.join(variantDir, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
  const settingsPath = path.join(variantDir, 'config', 'settings.json');

  log.info('Team Mode Enabler for claude-sneakpeek');
  log.plain('==================================\n');

  if (!fs.existsSync(variantDir)) {
    log.error(`Error: Variant '${variantName}' not found at ${variantDir}\n`);
    log.plain('Available variants:');
    const entries = fs.existsSync(rootDir) ? fs.readdirSync(rootDir) : [];
    const variants = entries.filter((e) => fs.statSync(path.join(rootDir, e)).isDirectory());
    if (variants.length > 0) {
      for (const v of variants) {
        log.plain(`  ${v}`);
      }
    } else {
      log.plain('  (none)');
    }
    log.plain('\nCreate a variant first with:');
    log.plain(`  npm run dev -- create --provider <provider> --name ${variantName}`);
    return 1;
  }

  if (!fs.existsSync(cliPath)) {
    log.error(`Error: cli.js not found at ${cliPath}`);
    log.plain('The variant may not have Claude Code installed correctly.');
    return 1;
  }

  // Backup CLI
  const backupPath = cliPath + '.backup';
  if (!fs.existsSync(backupPath)) {
    log.plain('Creating backup of cli.js...');
    fs.copyFileSync(cliPath, backupPath);
    log.success(`Backup created at ${backupPath}`);
  } else {
    log.plain('Backup already exists, skipping...\n');
  }

  // Check current state
  const cliContent = fs.readFileSync(cliPath, 'utf8');
  if (cliContent.includes('function sU(){return!0}')) {
    log.success('Team mode is already enabled!\n');
  } else {
    log.plain('Patching cli.js to enable team mode...');

    // Patch: change sU() to return true
    const patched = cliContent.replace(/function sU\(\)\{return!1\}/g, 'function sU(){return!0}');

    if (patched === cliContent) {
      log.error('Failed to patch cli.js (pattern not found)');
      return 1;
    }

    fs.writeFileSync(cliPath, patched);
    log.success('Patched successfully!');

    // Verify
    const newContent = fs.readFileSync(cliPath, 'utf8');
    if (newContent.includes('function sU(){return!0}')) {
      log.success('Verification passed: sU() now returns true\n');
    } else {
      log.error('Verification failed: patch may not have applied correctly');
      return 1;
    }
  }

  // Add team environment variables to settings.json
  log.plain('Configuring team environment variables...');

  let settings: Settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      // Invalid JSON, will overwrite
    }
  }

  if (!settings.env) settings.env = {};

  const hasTeamVars = settings.env.CLAUDE_CODE_TEAM_NAME || settings.env.CLAUDE_CODE_AGENT_TYPE;

  if (hasTeamVars) {
    log.plain('Team environment variables already configured.');
  } else {
    settings.env.CLAUDE_CODE_TEAM_NAME = variantName;
    settings.env.CLAUDE_CODE_AGENT_TYPE = settings.env.CLAUDE_CODE_AGENT_TYPE || 'team-lead';

    ensureDir(path.dirname(settingsPath));
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    log.success('Team environment variables added to settings.json');
  }

  log.success('\n========================================');
  log.success(`Team mode enabled for variant: ${variantName}`);
  log.success('========================================\n');
  log.plain('Usage:');
  log.plain(`  ${variantName}                    # Start with team mode\n`);
  log.plain('Or with custom agent identity:');
  log.plain(`  CLAUDE_CODE_AGENT_ID=worker-1 ${variantName}\n`);
  log.plain(`Task storage location (isolated per variant):`);
  log.plain(`  ${path.join(rootDir, variantName, 'config', 'tasks', variantName)}/\n`);
  log.plain(`To restore original CLI:`);
  log.plain(`  cp '${backupPath}' '${cliPath}'\n`);

  return 0;
};

// ============================================================================
// CLI
// ============================================================================

const printUsage = (): void => {
  log.plain('Usage: node scripts/variant-tools.ts <command> [options]\n');
  log.plain('Commands:');
  log.plain('  build-variants        Build Z.ai and MiniMax variants');
  log.plain('  list-variants         List all installed variants');
  log.plain('  enable-team-mode      Enable team mode for a variant\n');
  log.plain('Options for build-variants:');
  log.plain('  --root-dir <dir>      Root directory for variants');
  log.plain('  --bin-dir <dir>       Directory for wrapper scripts');
  log.plain('  --claude-orig <path>  Path to claude binary');
  log.plain('  --zai-key <key>       Z.ai API key');
  log.plain('  --minimax-key <key>   MiniMax API key\n');
  log.plain('Examples:');
  log.plain('  node scripts/variant-tools.ts build-variants');
  log.plain('  node scripts/variant-tools.ts enable-team-mode my-variant');
  log.plain('  node scripts/variant-tools.ts list-variants\n');
};

const main = (): number => {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    return 0;
  }

  const command = args[0];

  switch (command) {
    case 'build-variants': {
      const opts: BuildVariantsOptions = {};
      for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
          case '--root-dir':
            opts.rootDir = args[++i];
            break;
          case '--bin-dir':
            opts.binDir = args[++i];
            break;
          case '--claude-orig':
            opts.claudeOrig = args[++i];
            break;
          case '--zai-key':
            opts.zaiApiKey = args[++i];
            break;
          case '--minimax-key':
            opts.minimaxApiKey = args[++i];
            break;
          default:
            log.error(`Unknown option: ${args[i]}`);
            return 1;
        }
      }
      return buildVariants(opts);
    }

    case 'list-variants':
      return listVariants();

    case 'enable-team-mode': {
      const variantName = args[1];
      if (!variantName) {
        log.error('Error: variant name required');
        log.plain('\nUsage: node scripts/variant-tools.ts enable-team-mode <variant-name>');
        return 1;
      }
      return enableTeamMode(variantName);
    }

    default:
      log.error(`Unknown command: ${command}`);
      log.plain('\nRun: node scripts/variant-tools.ts --help');
      return 1;
  }
};

process.exit(main());
