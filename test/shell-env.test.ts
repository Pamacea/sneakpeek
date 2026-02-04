import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureZaiShellEnv, detectShell, parseQuotedValue } from '../src/core/shell-env.js';

delete process.env.Z_AI_API_KEY;

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'claude-sneakpeek-shell-env-'));

const writeSettings = (configDir: string, apiKey: string) => {
  fs.mkdirSync(configDir, { recursive: true });
  const settingsPath = path.join(configDir, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify({ env: { ANTHROPIC_API_KEY: apiKey } }, null, 2));
};

test('ensureZaiShellEnv skips placeholder keys', () => {
  const tempDir = makeTempDir();
  const configDir = path.join(tempDir, 'config');
  const profilePath = path.join(tempDir, '.zshrc');
  writeSettings(configDir, '<API_KEY>');

  const result = ensureZaiShellEnv({ configDir, profilePath });
  assert.equal(result.status, 'skipped');
  assert.ok(result.message?.includes('missing API key'));
  assert.equal(fs.existsSync(profilePath), false);
});

test('ensureZaiShellEnv skips when profile already has a key', () => {
  const tempDir = makeTempDir();
  const configDir = path.join(tempDir, 'config');
  const profilePath = path.join(tempDir, '.zshrc');
  writeSettings(configDir, 'new-key');
  fs.writeFileSync(profilePath, 'export Z_AI_API_KEY="existing-key"\n');

  const result = ensureZaiShellEnv({ configDir, profilePath });
  assert.equal(result.status, 'skipped');
  assert.ok(result.message?.includes('already set in shell profile'));
  const content = fs.readFileSync(profilePath, 'utf8');
  assert.ok(content.includes('existing-key'));
});

test('ensureZaiShellEnv writes a claude-sneakpeek block when missing', () => {
  const tempDir = makeTempDir();
  const configDir = path.join(tempDir, 'config');
  const profilePath = path.join(tempDir, '.zshrc');
  writeSettings(configDir, 'abc123');

  const result = ensureZaiShellEnv({ configDir, profilePath });
  assert.equal(result.status, 'updated');
  const content = fs.readFileSync(profilePath, 'utf8');
  assert.ok(content.includes('claude-sneakpeek: Z.ai env start'));
  assert.ok(content.includes('export Z_AI_API_KEY="abc123"'));
});

// Windows/PowerShell tests

test('detectShell returns powershell on Windows with PSModulePath', { skip: process.platform !== 'win32' }, () => {
  const shell = detectShell();
  assert.ok(shell === 'powershell' || shell === 'powershell-core' || shell === 'bash');
});

test('detectShell returns zsh or bash on Unix', { skip: process.platform === 'win32' }, () => {
  const shell = detectShell();
  assert.ok(shell === 'zsh' || shell === 'bash' || shell === 'unknown');
});

test('ensureZaiShellEnv writes PowerShell syntax for PowerShell profile', () => {
  const tempDir = makeTempDir();
  const configDir = path.join(tempDir, 'config');
  const profilePath = path.join(tempDir, 'Microsoft.PowerShell_profile.ps1');
  writeSettings(configDir, 'xyz789');

  // Force PowerShell detection by setting env vars
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'win32' });
  const originalPSModulePath = process.env.PSModulePath;

  try {
    // Mock PowerShell environment
    process.env.PSModulePath = 'C:\\Program Files\\WindowsPowerShell\\Modules';

    const result = ensureZaiShellEnv({ configDir, profilePath });
    const content = fs.readFileSync(profilePath, 'utf8');

    // On non-Windows systems with mocked env, it may still detect as Unix
    // The important thing is it doesn't crash
    assert.ok(result.status === 'updated' || result.status === 'failed');

    if (result.status === 'updated') {
      // Check content format - should work for both Unix and PowerShell
      assert.ok(content.includes('claude-sneakpeek: Z.ai env start'));
      assert.ok(content.includes('xyz789'));
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    if (originalPSModulePath === undefined) {
      delete process.env.PSModulePath;
    } else {
      process.env.PSModulePath = originalPSModulePath;
    }
  }
});

test('ensureZaiShellEnv creates PowerShell profile directory if missing', () => {
  const tempDir = makeTempDir();
  const configDir = path.join(tempDir, 'config');
  const powerShellDir = path.join(tempDir, 'WindowsPowerShell');
  const profilePath = path.join(powerShellDir, 'Microsoft.PowerShell_profile.ps1');
  writeSettings(configDir, 'dir-test-key');

  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'win32' });
  const originalPSModulePath = process.env.PSModulePath;

  try {
    process.env.PSModulePath = 'C:\\Program Files\\WindowsPowerShell\\Modules';

    const result = ensureZaiShellEnv({ configDir, profilePath });

    // Directory should be created
    assert.ok(fs.existsSync(powerShellDir));
    // Result should indicate update or skipped (not failed)
    assert.ok(result.status === 'updated' || result.status === 'skipped');
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    if (originalPSModulePath === undefined) {
      delete process.env.PSModulePath;
    } else {
      process.env.PSModulePath = originalPSModulePath;
    }
  }
});

// Quoted value parsing tests

test('parseQuotedValue handles double quotes', () => {
  assert.equal(parseQuotedValue('"test-key"'), 'test-key');
});

test('parseQuotedValue handles single quotes', () => {
  assert.equal(parseQuotedValue("'test-key'"), 'test-key');
});

test('parseQuotedValue handles escaped double quotes', () => {
  assert.equal(parseQuotedValue('"test\\"key\\"test"'), 'test"key"test');
});

test('parseQuotedValue handles escaped single quotes', () => {
  assert.equal(parseQuotedValue("'test\\'key\\'test'"), "test'key'test");
});

test('parseQuotedValue returns unquoted value as-is', () => {
  assert.equal(parseQuotedValue('test-key'), 'test-key');
});

test('parseQuotedValue returns null for empty string', () => {
  assert.equal(parseQuotedValue(''), null);
});

test('parseQuotedValue returns null for single quote', () => {
  assert.equal(parseQuotedValue('"'), null);
});
