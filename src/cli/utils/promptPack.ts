/**
 * Prompt pack utilities
 */

/**
 * Parse prompt pack mode from string value
 */
export function parsePromptPackMode(value?: string): 'minimal' | 'maximal' | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === 'minimal' || normalized === 'maximal') return normalized;
  return undefined;
}
