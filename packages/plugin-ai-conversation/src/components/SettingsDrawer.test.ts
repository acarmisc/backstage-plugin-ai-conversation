import { hasCustomSettings } from './SettingsDrawer';

const defaults = {
  toneId: '',
  focusId: '',
  verbosityId: '',
  reasoningEffort: '',
  webSearch: false,
  customSystemPrompt: '',
};

describe('hasCustomSettings', () => {
  it('is false when everything is unset', () => {
    expect(hasCustomSettings(defaults)).toBe(false);
    expect(hasCustomSettings({ ...defaults, customSystemPrompt: '   ' })).toBe(false);
  });

  it.each([
    ['toneId', 'friendly'],
    ['focusId', 'code'],
    ['verbosityId', 'concise'],
    ['reasoningEffort', 'high'],
    ['webSearch', true],
    ['customSystemPrompt', 'Answer in Italian'],
  ])('is true when %s is set', (key, value) => {
    expect(hasCustomSettings({ ...defaults, [key]: value })).toBe(true);
  });
});
