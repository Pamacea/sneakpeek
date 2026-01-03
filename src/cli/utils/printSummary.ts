/**
 * Print variant operation summary to console
 */

import type { VariantMeta } from '../../core/types.js';

export interface PrintSummaryOptions {
  action: string;
  meta: VariantMeta;
  wrapperPath?: string;
  notes?: string[];
  shareUrl?: string;
}

export function printSummary(opts: PrintSummaryOptions): void {
  const { action, meta, wrapperPath, notes, shareUrl } = opts;
  console.log(`\n${action}: ${meta.name}`);
  console.log(`Provider: ${meta.provider}`);
  if (meta.promptPack !== undefined) {
    const mode = meta.promptPackMode || 'maximal';
    console.log(`Prompt pack: ${meta.promptPack ? `on (${mode})` : 'off'}`);
  }
  if (meta.skillInstall !== undefined) {
    console.log(`dev-browser skill: ${meta.skillInstall ? 'on' : 'off'}`);
  }
  if (meta.shellEnv !== undefined && meta.provider === 'zai') {
    console.log(`Shell env: ${meta.shellEnv ? 'write Z_AI_API_KEY' : 'manual'}`);
  }
  if (wrapperPath) console.log(`Wrapper: ${wrapperPath}`);
  if (meta.configDir) console.log(`Config: ${meta.configDir}`);
  if (notes && notes.length > 0) {
    console.log('Notes:');
    for (const note of notes) console.log(`- ${note}`);
  }
  console.log('Next steps:');
  console.log(`- Run: ${meta.name}`);
  console.log(`- Update: cc-mirror update ${meta.name}`);
  console.log(`- Tweak: cc-mirror tweak ${meta.name}`);
  console.log('Help: cc-mirror help');
  if (shareUrl) {
    console.log('Share:');
    console.log(shareUrl);
  }
  console.log('');
}
