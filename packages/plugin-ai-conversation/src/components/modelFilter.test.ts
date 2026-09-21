import {
  ALL_PROXY_MODELS,
  filterModels,
  filterModelsByTeam,
  isModelAllowedByTeam,
  isModelExcluded,
} from './modelFilter';

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

describe('isModelAllowedByTeam', () => {
  it('allows everything when the team has no allowlist', () => {
    expect(isModelAllowedByTeam({ model_name: 'gpt-4o' }, undefined)).toBe(true);
    expect(isModelAllowedByTeam({ model_name: 'gpt-4o' }, [])).toBe(true);
    expect(isModelAllowedByTeam({ model_name: 'gpt-4o' }, null)).toBe(true);
  });

  it('allows everything for the all-proxy-models sentinel', () => {
    expect(
      isModelAllowedByTeam({ model_name: 'gpt-4o' }, [ALL_PROXY_MODELS]),
    ).toBe(true);
  });

  it('matches literal model names', () => {
    expect(isModelAllowedByTeam({ model_name: 'gpt-4o' }, ['gpt-4o'])).toBe(true);
    expect(isModelAllowedByTeam({ model_name: 'gpt-4o' }, ['gpt-3.5'])).toBe(false);
  });

  it('matches access-group names', () => {
    const model = { model_name: 'claude-3-5-sonnet', access_groups: ['tier-a'] };
    expect(isModelAllowedByTeam(model, ['tier-a'])).toBe(true);
    expect(isModelAllowedByTeam(model, ['tier-b'])).toBe(false);
  });
});

describe('filterModelsByTeam', () => {
  const models = [
    { model_name: 'gpt-4o', access_groups: ['tier-a'] },
    { model_name: 'claude-3-5-sonnet', access_groups: ['tier-b'] },
  ];

  it('returns the input untouched when no team is selected', () => {
    expect(filterModelsByTeam(models, undefined)).toBe(models);
  });

  it('keeps only models the team allows', () => {
    expect(filterModelsByTeam(models, ['gpt-4o'])).toEqual([
      { model_name: 'gpt-4o', access_groups: ['tier-a'] },
    ]);
  });

  it('keeps models matched via access group', () => {
    expect(filterModelsByTeam(models, ['tier-b'])).toEqual([
      { model_name: 'claude-3-5-sonnet', access_groups: ['tier-b'] },
    ]);
  });

  it('keeps everything for the sentinel allowlist', () => {
    expect(filterModelsByTeam(models, [ALL_PROXY_MODELS])).toEqual(models);
  });
});
