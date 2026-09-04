# Chat skills

A **skill** is a reusable system-prompt preset the user can pick in the chat
settings panel. Picking one sends its `skill_id` with each turn; the backend
resolves the prompt server-side and prepends it as a system message (it never
reaches the browser). A skill can also declare a default model and knowledge
bases, which the picker prefills.

## The one artifact: `SKILL.md`

Whatever the discovery mechanism, a skill is authored as a single Markdown
file with YAML frontmatter:

```markdown
---
name: Data Analyst
description: Use when exploring datasets, writing SQL, or explaining results.
model: gpt-4o                 # optional — omit to inherit the user's pick
vectorStores: [analytics-kb]  # optional — store names, resolved to ids
tags: [data, sql]
---

You are a senior data analyst…

{{include: ./sql-style-guide.md}}
```

- `{{include: <relative-path>}}` on its own line transcludes another file
  (recursively, cycle-guarded). Use it to share fragments between skills.
- Frontmatter of an included file is stripped — only the top file's counts.
- `description` is what the user reads in the picker. Write it as "use this
  when…". Keep prompts free of tone/verbosity instructions — those are
  separate, independently-selectable layers.

## Where skills come from

Configured via `litellm.aiConversation.skills.sources` (order = precedence;
first to claim an id wins). Default when unset: `bundled` then `catalog`.

### `bundled` — Tier 1

`<slug>/SKILL.md` directories shipped inside the backend package (this
folder), or any local path via `skills.bundledPath`. No catalog wiring, so
the picker is never empty on a fresh install. Metadata comes entirely from
the frontmatter. Ids look like `skill:bundled/<slug>`.

### `catalog` — Tier 2

Backstage `Component` entities with `spec.type: chat-skill`, discovered by
whatever catalog providers the host app already runs. Ownership, tags and
RBAC come from the catalog. The prompt is a
`chat-skill.acarmisc.org/system-prompt-ref` annotation pointing at a
`SKILL.md` (resolved via the entity's `backstage.io/managed-by-location`),
or a legacy inline `chat-skill.acarmisc.org/system-prompt` one-liner.

Annotations `default-model` / `default-vector-stores` / the entity
`description` still work, but when absent they fall back to the referenced
`SKILL.md`'s frontmatter — so a one-line `catalog-info.yaml` plus a rich
`SKILL.md` is enough:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: data-analyst
  annotations:
    chat-skill.acarmisc.org/system-prompt-ref: ./SKILL.md
spec:
  type: chat-skill
  lifecycle: production
  owner: team-data
```

## Best practices

- One skill = one directory with a `SKILL.md`; extra fragments as sibling
  `.md` files pulled in with `{{include}}`.
- Keep prompts in version control; review changes by PR; use CODEOWNERS per
  directory for ownership.
- Pin `model` only when the skill genuinely needs a specific one.
- Composed prompts are cached server-side for ~5 minutes — edits show up on
  the next cache miss, no redeploy needed.
