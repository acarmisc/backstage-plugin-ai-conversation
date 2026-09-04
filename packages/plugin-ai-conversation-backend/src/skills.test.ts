import * as path from 'path';
import {
  parseFrontmatter,
  bundledSkillSource,
  BUNDLED_SKILL_ID_PREFIX,
} from './skills';

describe('parseFrontmatter', () => {
  it('splits a YAML frontmatter block off the body', () => {
    const { meta, body } = parseFrontmatter(
      '---\nname: Data Analyst\ntags: [data, sql]\n---\nYou are an analyst.\n',
    );
    expect(meta).toEqual({ name: 'Data Analyst', tags: ['data', 'sql'] });
    expect(body).toBe('You are an analyst.\n');
  });

  it('returns the whole text as body when there is no frontmatter', () => {
    const { meta, body } = parseFrontmatter('Just a prompt.');
    expect(meta).toEqual({});
    expect(body).toBe('Just a prompt.');
  });

  it('never throws on a malformed block — empty meta, body after the fence', () => {
    const { meta, body } = parseFrontmatter('---\nname: : :\n---\nbody');
    expect(meta).toEqual({});
    expect(body).toBe('body');
  });
});

describe('bundledSkillSource', () => {
  const dir = path.join(__dirname, '..', 'skills');
  const source = bundledSkillSource(dir);

  it('lists the SKILL.md dirs shipped with the package', async () => {
    const skills = await source.list();
    const ids = skills.map(s => s.id).sort();
    expect(ids).toEqual([
      `${BUNDLED_SKILL_ID_PREFIX}code-reviewer`,
      `${BUNDLED_SKILL_ID_PREFIX}data-analyst`,
      `${BUNDLED_SKILL_ID_PREFIX}technical-writer`,
    ]);
    const reviewer = skills.find(s => s.id === `${BUNDLED_SKILL_ID_PREFIX}code-reviewer`)!;
    expect(reviewer.title).toBe('Code Reviewer');
    expect(reviewer.description).toMatch(/reviewing a diff/i);
    expect(reviewer.tags).toContain('review');
  });

  it('resolves a prompt and expands {{include}} relative to the SKILL.md', async () => {
    const prompt = await source.resolvePrompt(`${BUNDLED_SKILL_ID_PREFIX}technical-writer`);
    expect(prompt).toMatch(/technical writer/i);
    // style-notes.md is pulled in via {{include: ./style-notes.md}}
    expect(prompt).toMatch(/Oxford comma/);
    // frontmatter must not leak into the composed prompt
    expect(prompt).not.toMatch(/description:/);
  });

  it('returns undefined for ids it does not own', async () => {
    expect(await source.resolvePrompt('component:default/something')).toBeUndefined();
    expect(await source.resolvePrompt(`${BUNDLED_SKILL_ID_PREFIX}../secrets`)).toBeUndefined();
    expect(await source.resolvePrompt(`${BUNDLED_SKILL_ID_PREFIX}nope`)).toBeUndefined();
  });
});
