import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

export const isWindows = process.platform === 'win32';

export const expandTilde = (input?: string): string | undefined => {
  if (!input) return input;
  if (input === '~') return os.homedir();
  if (input.startsWith('~/')) return path.join(os.homedir(), input.slice(2));
  return input;
};

const normalizeWrapperBaseName = (name: string): string => {
  if (!isWindows) return name;
  return name.toLowerCase().endsWith('.cmd') ? name.slice(0, -4) : name;
};

export const getWrapperFilename = (name: string): string =>
  isWindows ? `${normalizeWrapperBaseName(name)}.cmd` : name;

export const getWrapperScriptFilename = (name: string): string => `${normalizeWrapperBaseName(name)}.mjs`;

export const getWrapperPath = (binDir: string, name: string): string => path.join(binDir, getWrapperFilename(name));

export const getWrapperScriptPath = (binDir: string, name: string): string =>
  path.join(binDir, getWrapperScriptFilename(name));

export const commandExists = (cmd: string): boolean => {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
    encoding: 'utf8',
  });
  return result.status === 0 && result.stdout.trim().length > 0;
};
