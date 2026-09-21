import { filterModels, isModelExcluded } from './modelFilter';

describe('isModelExcluded', () => {
  it('returns false when no patterns are configured', () => {
    expect(isModelExcluded('gpt-4', undefined)).toBe(false);
    expect(isModelExcluded('gpt-4', [])).toBe(false);
    expect(isModelExcluded('gpt-4', null)).toBe(false);
  });

  it('matches exact names case-insensitively', () => {
    expect(isModelExcluded('claude-3-5-sonnet', ['claude-3-5-sonnet'])).toBe(true);
    expect(isModelExcluded('CLAUDE-3-5-SONNET', ['claude-3-5-sonnet'])).toBe(true);
    expect(isModelExcluded('claude-3-opus', ['claude-3-5-sonnet'])).toBe(false);
  });

  it('treats a trailing * as a prefix match', () => {
    expect(isModelExcluded('claude-3-5-sonnet', ['claude-*'])).toBe(true);
    expect(isModelExcluded('claude-3-opus', ['claude*'])).toBe(true);
    expect(isModelExcluded('gpt-4o', ['claude*'])).toBe(false);
  });

  it('ignores blank patterns and tolerates surrounding whitespace', () => {
    expect(isModelExcluded('gpt-4o', ['', '   '])).toBe(false);
    expect(isModelExcluded('gpt-4o', ['  gpt-4o  '])).toBe(true);
  });

  it('excludes when any pattern matches', () => {
    expect(isModelExcluded('gemini-pro', ['claude*', 'gemini*'])).toBe(true);
  });
});

describe('filterModels', () => {
  const models = [
    { model_name: 'gpt-4o' },
    { model_name: 'claude-3-5-sonnet' },
    { model_name: 'claude-3-opus' },
  ];

  it('returns the input untouched when no patterns are set', () => {
    expect(filterModels(models, m => m.model_name, null)).toBe(models);
  });

  it('drops everything matching the configured patterns', () => {
    expect(filterModels(models, m => m.model_name, ['claude*'])).toEqual([
      { model_name: 'gpt-4o' },
    ]);
  });
});
