import { getStarterPrompts } from './suggestions';

describe('getStarterPrompts', () => {
  it('returns 4 generic prompts when no skill is provided', () => {
    const prompts = getStarterPrompts();
    expect(prompts).toHaveLength(4);
    expect(prompts[0]).toBe('Summarize the key points of our onboarding docs');
    expect(prompts[1]).toBe('Explain this error message and how to fix it');
    expect(prompts[2]).toBe('Draft a short status update for my team');
    expect(prompts[3]).toBe('Compare two approaches and list trade-offs');
  });

  it('returns 4 generic prompts when skill is null', () => {
    const prompts = getStarterPrompts(null);
    expect(prompts).toHaveLength(4);
    expect(prompts[0]).toBe('Summarize the key points of our onboarding docs');
  });

  it('returns skill-flavored prompts when skill is provided', () => {
    const skill = { title: 'Data Analyst', tags: ['analytics'] };
    const prompts = getStarterPrompts(skill);

    expect(prompts).toHaveLength(4);
    expect(prompts[0]).toContain('Data Analyst');
    expect(prompts[1]).toContain('Data Analyst');
    expect(prompts[2]).toContain('Data Analyst');
    expect(prompts[3]).toContain('Data Analyst');
  });

  it('uses skill title in prompts', () => {
    const skill = { title: 'DevOps Expert' };
    const prompts = getStarterPrompts(skill);

    expect(prompts[0]).toContain('DevOps Expert');
    expect(prompts.every(p => p.includes('DevOps Expert'))).toBe(true);
  });

  it('generates deterministic prompts for same skill', () => {
    const skill = { title: 'Python Developer' };
    const prompts1 = getStarterPrompts(skill);
    const prompts2 = getStarterPrompts(skill);

    expect(prompts1).toEqual(prompts2);
  });

  it('generates different prompts for different skills', () => {
    const skill1 = { title: 'Frontend Expert' };
    const skill2 = { title: 'Backend Expert' };

    const prompts1 = getStarterPrompts(skill1);
    const prompts2 = getStarterPrompts(skill2);

    expect(prompts1).not.toEqual(prompts2);
    expect(prompts1[0]).toContain('Frontend Expert');
    expect(prompts2[0]).toContain('Backend Expert');
  });

  it('ignores skill tags when generating prompts', () => {
    const skill1 = { title: 'Analyst', tags: [] };
    const skill2 = { title: 'Analyst', tags: ['data', 'analytics', 'reporting'] };

    const prompts1 = getStarterPrompts(skill1);
    const prompts2 = getStarterPrompts(skill2);

    expect(prompts1).toEqual(prompts2);
  });

  it('handles skill names with special characters', () => {
    const skill = { title: 'C++ Developer' };
    const prompts = getStarterPrompts(skill);

    expect(prompts[0]).toContain('C++ Developer');
    expect(prompts).toHaveLength(4);
  });

  it('handles empty skill title', () => {
    const skill = { title: '' };
    const prompts = getStarterPrompts(skill);

    expect(prompts).toHaveLength(4);
    expect(prompts[0]).toContain('Ask :');
  });

  it('all prompts are non-empty strings', () => {
    const generic = getStarterPrompts();
    const withSkill = getStarterPrompts({ title: 'Test Skill' });

    expect(generic.every(p => typeof p === 'string' && p.length > 0)).toBe(true);
    expect(withSkill.every(p => typeof p === 'string' && p.length > 0)).toBe(true);
  });
});
