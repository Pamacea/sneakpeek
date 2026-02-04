import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readJson } from './fs.js';
import { isWindows } from './paths.js';

type SettingsFile = {
  env?: Record<string, string | number | undefined>;
};

export type ShellEnvStatus = 'updated' | 'skipped' | 'failed';

export interface ShellEnvResult {
  status: ShellEnvStatus;
  message?: string;
  path?: string;
}

export type ShellType = 'zsh' | 'bash' | 'powershell' | 'powershell-core' | 'unknown';

const SETTINGS_FILE = 'settings.json';
const BLOCK_START_UNIX = '# claude-sneakpeek: Z.ai env start';
const BLOCK_END_UNIX = '# claude-sneakpeek: Z.ai env end';
const BLOCK_START_POWERSHELL = '# claude-sneakpeek: Z.ai env start';
const BLOCK_END_POWERSHELL = '# claude-sneakpeek: Z.ai env end';
const PLACEHOLDER_KEY = '<API_KEY>';

const normalizeApiKey = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === PLACEHOLDER_KEY) return null;
  return trimmed;
};

/**
 * Detect the current shell type
 */
export const detectShell = (): ShellType => {
  if (isWindows) {
    // Check for PowerShell Core (pwsh) or Windows PowerShell (powershell)
    if (process.env.PSModulePath) {
      return process.env.PWSH ? 'powershell-core' : 'powershell';
    }
    // Check for Git Bash on Windows
    if (process.env.SHELL && process.env.SHELL.includes('bash')) {
      return 'bash';
    }
    return 'unknown';
  }

  // Unix-like systems
  const shell = process.env.SHELL || '';
  const name = path.basename(shell);

  if (name === 'zsh') return 'zsh';
  if (name === 'bash') return 'bash';
  return 'unknown';
};

/**
 * Resolve the shell profile file path based on the detected shell
 */
const resolveShellProfile = (): string | null => {
  const home = os.homedir();
  const shell = detectShell();

  if (shell === 'powershell' || shell === 'powershell-core') {
    // PowerShell 5 (Windows PowerShell) or PowerShell 7 (Core)
    // Profile path can be in different locations depending on PowerShell version
    // Use $PROFILE variable if set, otherwise default to standard locations
    const profileEnv = process.env.PROFILE;
    if (profileEnv && fs.existsSync(profileEnv)) return profileEnv;

    // Default PowerShell profile paths
    const documentsPath = path.join(home, 'Documents');
    const psPath = path.join(documentsPath, 'WindowsPowerShell');
    const ps7Path = path.join(documentsPath, 'PowerShell');

    // Try PowerShell 7 profile first (if Core detected)
    if (shell === 'powershell-core') {
      const profile = path.join(ps7Path, 'Microsoft.PowerShell_profile.ps1');
      if (fs.existsSync(profile)) return profile;
      // Return default even if doesn't exist - we'll create the directory
      return profile;
    }

    // Try Windows PowerShell profile
    const profile = path.join(psPath, 'Microsoft.PowerShell_profile.ps1');
    if (fs.existsSync(profile)) return profile;
    return profile;
  }

  if (shell === 'bash') {
    const bashrc = path.join(home, '.bashrc');
    if (fs.existsSync(bashrc)) return bashrc;
    return path.join(home, '.bash_profile');
  }

  if (shell === 'zsh') {
    return path.join(home, '.zshrc');
  }

  return null;
};

/**
 * Detect shell type from profile file path
 */
const detectShellFromPath = (profilePath: string): ShellType => {
  const basename = path.basename(profilePath);

  // PowerShell profiles
  if (basename.endsWith('.ps1')) {
    return 'powershell';
  }

  // Unix shells
  if (basename === '.zshrc') return 'zsh';
  if (basename === '.bashrc' || basename === '.bash_profile') return 'bash';

  // Default to unknown - will use environment detection
  return 'unknown';
};

const readSettingsApiKey = (configDir: string): string | null => {
  const settingsPath = path.join(configDir, SETTINGS_FILE);
  if (!fs.existsSync(settingsPath)) return null;
  const settings = readJson<SettingsFile>(settingsPath);
  const key = settings?.env?.ANTHROPIC_API_KEY;
  if (typeof key !== 'string') return null;
  return normalizeApiKey(key);
};

/**
 * Render the environment variable block for the detected shell type
 */
const renderBlock = (apiKey: string, shell: ShellType): string => {
  if (shell === 'powershell' || shell === 'powershell-core') {
    // PowerShell syntax: $env:VARIABLE = "value"
    return `${BLOCK_START_POWERSHELL}\n$env:Z_AI_API_KEY="${apiKey}"\n${BLOCK_END_POWERSHELL}\n`;
  }
  // Unix shells: export VARIABLE="value"
  return `${BLOCK_START_UNIX}\nexport Z_AI_API_KEY="${apiKey}"\n${BLOCK_END_UNIX}\n`;
};

/**
 * Get block markers for the detected shell type
 */
const getBlockMarkers = (shell: ShellType) => {
  if (shell === 'powershell' || shell === 'powershell-core') {
    return { start: BLOCK_START_POWERSHELL, end: BLOCK_END_POWERSHELL };
  }
  return { start: BLOCK_START_UNIX, end: BLOCK_END_UNIX };
};

const upsertBlock = (content: string, block: string, shell: ShellType) => {
  const { start, end } = getBlockMarkers(shell);
  if (content.includes(start) && content.includes(end)) {
    const startIndex = content.indexOf(start);
    const endIndex = content.indexOf(end, startIndex);
    const before = content.slice(0, startIndex).trimEnd();
    const after = content.slice(endIndex + end.length).trimStart();
    return `${before}\n\n${block}\n${after}`.trimEnd() + '\n';
  }
  return `${content.trimEnd()}\n\n${block}`.trimEnd() + '\n';
};

/**
 * Parse a quoted string value, handling escaped quotes
 * Supports: "value", 'value', "value\"with\"escapes", 'value\'with\'escapes'
 */
export const parseQuotedValue = (value: string): string | null => {
  value = value.trim();
  if (value.length < 2) return null;

  const firstChar = value[0];
  const lastChar = value[value.length - 1];

  if ((firstChar === '"' && lastChar === '"') || (firstChar === "'" && lastChar === "'")) {
    let inner = value.slice(1, -1);
    // Handle escaped quotes: \" -> ", \' -> '
    // Use replaceAll to handle all occurrences
    const escapeChar = firstChar; // " or '
    inner = inner.replaceAll(`\\${escapeChar}`, escapeChar);
    return inner;
  }

  // Unquoted value
  return value;
};

/**
 * Check if Z_AI_API_KEY is already set in the profile content
 */
const hasZaiKeyInProfile = (content: string, shell: ShellType): boolean => {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Handle PowerShell syntax: $env:Z_AI_API_KEY = "value"
    if (shell === 'powershell' || shell === 'powershell-core') {
      const envStripped = trimmed.startsWith('$env:') ? trimmed.slice(5) : trimmed;
      if (!envStripped.startsWith('Z_AI_API_KEY')) continue;
      const equalsIndex = envStripped.indexOf('=');
      if (equalsIndex === -1) continue;
      const rawValue = envStripped.slice(equalsIndex + 1).trim();
      const value = parseQuotedValue(rawValue);
      if (value && normalizeApiKey(value)) return true;
    } else {
      // Handle Unix shell syntax: export Z_AI_API_KEY="value" or Z_AI_API_KEY="value"
      const exportStripped = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
      if (!exportStripped.startsWith('Z_AI_API_KEY')) continue;
      const equalsIndex = exportStripped.indexOf('=');
      if (equalsIndex === -1) continue;
      const rawValue = exportStripped.slice(equalsIndex + 1).trim();
      const value = parseQuotedValue(rawValue);
      if (value && normalizeApiKey(value)) return true;
    }
  }
  return false;
};

/**
 * Ensure Z.ai environment variable is set in the shell profile
 * Supports: bash, zsh, PowerShell 5, PowerShell 7
 */
export const ensureZaiShellEnv = (opts: {
  apiKey?: string | null;
  configDir: string;
  profilePath?: string;
}): ShellEnvResult => {
  const apiKey = normalizeApiKey(opts.apiKey) || readSettingsApiKey(opts.configDir);
  if (!apiKey) {
    return { status: 'skipped', message: 'Z_AI_API_KEY not set (missing API key)' };
  }

  const envKey = normalizeApiKey(process.env.Z_AI_API_KEY);
  if (envKey) {
    return { status: 'skipped', message: 'Z_AI_API_KEY already set in environment' };
  }

  // Determine shell type: from profile path if provided, otherwise detect from environment
  const profile = opts.profilePath ?? resolveShellProfile();
  if (!profile) {
    return {
      status: 'failed',
      message: isWindows
        ? 'Unsupported shell; please use PowerShell or Git Bash. Set Z_AI_API_KEY manually in settings.json.'
        : 'Unsupported shell; set Z_AI_API_KEY manually',
    };
  }

  const shell = opts.profilePath ? detectShellFromPath(opts.profilePath) : detectShell();

  // Create directory if needed (for PowerShell profiles)
  // Note: recursive mkdirSync is safe to call without existence check
  const profileDir = path.dirname(profile);
  try {
    fs.mkdirSync(profileDir, { recursive: true });
  } catch {
    // Ignore if directory creation fails (e.g., permissions)
  }

  const existing = fs.existsSync(profile) ? fs.readFileSync(profile, 'utf8') : '';
  if (hasZaiKeyInProfile(existing, shell)) {
    return { status: 'skipped', message: 'Z_AI_API_KEY already set in shell profile', path: profile };
  }

  const block = renderBlock(apiKey, shell);
  const next = upsertBlock(existing, block, shell);
  if (next === existing) {
    return { status: 'skipped', message: 'Shell profile already up to date', path: profile };
  }

  fs.writeFileSync(profile, next);

  // Return appropriate reload message based on shell
  let reloadMessage: string;
  if (shell === 'powershell' || shell === 'powershell-core') {
    reloadMessage = `Run: . $PROFILE`;
  } else {
    reloadMessage = `Run: source ${profile}`;
  }

  return { status: 'updated', path: profile, message: reloadMessage };
};
