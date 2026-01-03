/**
 * TUI Hooks Unit Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreateSummary, buildCreateNextSteps, buildHelpLines } from '../../src/tui/hooks/useVariantCreate.js';
import { buildUpdateSummary, buildUpdateNextSteps } from '../../src/tui/hooks/useVariantUpdate.js';

test('buildCreateSummary includes all expected fields', () => {
  const summary = buildCreateSummary({
    providerLabel: 'Zai Cloud',
    npmPackage: '@anthropic-ai/claude-code',
    npmVersion: '2.0.76',
    usePromptPack: true,
    promptPackMode: 'maximal',
    installSkill: true,
    modelOverrides: { sonnet: 'model-a', opus: 'model-b', haiku: 'model-c' },
    providerKey: 'zai',
    shellEnv: true,
    notes: ['Note 1'],
  });

  assert.ok(summary.some((line) => line.includes('Zai Cloud')));
  assert.ok(summary.some((line) => line.includes('@anthropic-ai/claude-code')));
  assert.ok(summary.some((line) => line.includes('maximal')));
  assert.ok(summary.some((line) => line.includes('dev-browser skill: on')));
  assert.ok(summary.some((line) => line.includes('Models:')));
  assert.ok(summary.some((line) => line.includes('Shell env:')));
  assert.ok(summary.some((line) => line.includes('Note 1')));
});

test('buildCreateSummary omits models when not set', () => {
  const summary = buildCreateSummary({
    providerLabel: 'OpenRouter',
    npmPackage: '@anthropic-ai/claude-code',
    npmVersion: '2.0.76',
    usePromptPack: false,
    promptPackMode: 'minimal',
    installSkill: false,
    modelOverrides: {},
    providerKey: 'openrouter',
    shellEnv: false,
  });

  assert.ok(!summary.some((line) => line.includes('Models:')));
  assert.ok(!summary.some((line) => line.includes('Shell env:')));
});

test('buildCreateSummary shows prompt pack off when disabled', () => {
  const summary = buildCreateSummary({
    providerLabel: 'Custom',
    npmPackage: '@anthropic-ai/claude-code',
    npmVersion: '2.0.76',
    usePromptPack: false,
    promptPackMode: 'minimal',
    installSkill: false,
    modelOverrides: {},
    providerKey: 'custom',
    shellEnv: false,
  });

  assert.ok(summary.some((line) => line.includes('Prompt pack: off')));
});

test('buildCreateNextSteps includes variant name and paths', () => {
  const steps = buildCreateNextSteps('my-variant', '/home/user/.cc-mirror');

  assert.ok(steps.some((line) => line.includes('Run: my-variant')));
  assert.ok(steps.some((line) => line.includes('Update: cc-mirror update my-variant')));
  assert.ok(steps.some((line) => line.includes('Tweak: cc-mirror tweak my-variant')));
  assert.ok(steps.some((line) => line.includes('Config:')));
  assert.ok(steps.some((line) => line.includes('/home/user/.cc-mirror')));
});

test('buildHelpLines returns standard help commands', () => {
  const help = buildHelpLines();

  assert.equal(help.length, 3);
  assert.ok(help.some((line) => line.includes('cc-mirror help')));
  assert.ok(help.some((line) => line.includes('cc-mirror list')));
  assert.ok(help.some((line) => line.includes('cc-mirror doctor')));
});

// Helper to create a valid VariantMeta for testing
function makeTestMeta(
  overrides: Partial<{
    name: string;
    provider: string;
    promptPack: boolean;
    promptPackMode: 'minimal' | 'maximal';
    skillInstall: boolean;
    shellEnv: boolean;
  }>
) {
  return {
    name: 'test',
    provider: 'test',
    createdAt: new Date().toISOString(),
    claudeOrig: '/path/to/claude',
    binaryPath: '/path/to/binary',
    configDir: '/path/to/config',
    tweakDir: '/path/to/tweak',
    ...overrides,
  };
}

test('buildUpdateSummary includes provider info', () => {
  const summary = buildUpdateSummary(
    makeTestMeta({
      provider: 'zai',
      promptPack: true,
      promptPackMode: 'maximal',
      skillInstall: true,
      shellEnv: true,
    }),
    ['Update note']
  );

  assert.ok(summary.some((line) => line.includes('Provider: zai')));
  assert.ok(summary.some((line) => line.includes('Prompt pack: on')));
  assert.ok(summary.some((line) => line.includes('dev-browser skill: on')));
  assert.ok(summary.some((line) => line.includes('Shell env:')));
  assert.ok(summary.some((line) => line.includes('Update note')));
});

test('buildUpdateSummary omits shell env for non-zai providers', () => {
  const summary = buildUpdateSummary(
    makeTestMeta({
      provider: 'minimax',
      promptPack: false,
      skillInstall: false,
      shellEnv: false,
    })
  );

  assert.ok(!summary.some((line) => line.includes('Shell env:')));
});

test('buildUpdateNextSteps includes variant operations', () => {
  const steps = buildUpdateNextSteps('my-variant', '/home/user/.cc-mirror');

  assert.ok(steps.some((line) => line.includes('Run: my-variant')));
  assert.ok(steps.some((line) => line.includes('Tweak: cc-mirror tweak my-variant')));
  assert.ok(steps.some((line) => line.includes('Config:')));
});
