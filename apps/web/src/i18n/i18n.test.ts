import { describe, expect, it } from 'vitest';
import { createTranslator } from './index.js';

describe('i18n', () => {
  it('returns key as fallback when missing', () => {
    const t = createTranslator('en-US');
    expect(t('unknown.key')).toBe('unknown.key');
  });

  it('replaces template variables', () => {
    const t = createTranslator('en-US');
    expect(t('result.failedCount', { count: 3 })).toBe('Failed operations: 3');
  });
});
