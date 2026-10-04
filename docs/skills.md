# Skills

A skill is a reusable system prompt users pick in the composer's **Skill**
picker or on the welcome screen. It can also preselect a model and
knowledge bases. The prompt text never reaches the browser: the frontend
only sends the skill's id, and the backend resolves and adds the prompt to
each turn.

The authoring reference with examples is
[`packages/plugin-ai-conversation-backend/skills/README.md`](../packages/plugin-ai-conversation-backend/skills/README.md).
This page summarises it.

## A skill is a `SKILL.md`

```markdown
---
name: Data Analyst
description: Use when exploring datasets, writing SQL, or explaining results.
model: gpt-4o                 # optional default model
vectorStores: [analytics-kb]  # optional knowledge bases, by name
tags: [data, sql]
---

You are a senior data analyst…

{{include: ./sql-style-guide.md}}
```

- `description` is what users read on the skill card: write it as "Use
  when…".
- `{{include: <relative path>}}` on its own line pulls in another Markdown
  file (recursively, with cycle and depth guards), so skills can share
  fragments. The frontmatter of included files is dropped.
- Knowledge base names are resolved to LiteLLM vector store ids; names that
  don't resolve are skipped.
- Leave tone and length out of the prompt: users choose those separately (see
  below).

## Where skills come from

`litellm.aiConversation.skills.sources` lists the sources in order of
precedence (default: `bundled`, then `catalog`).

| Source | What it reads | Id |
| --- | --- | --- |
| `bundled` | `<slug>/SKILL.md` folders shipped with the backend (`code-reviewer`, `data-analyst`, `technical-writer`), or `skills.bundledPath` | `skill:bundled/<slug>` |
| `catalog` | `Component` entities with `spec.type: chat-skill` | the entity ref |

A catalog skill is a small `catalog-info.yaml` next to its `SKILL.md`, so any
team can publish one through the catalog providers you already run:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: data-analyst
  description: Use when exploring datasets, writing SQL, or explaining results.
  annotations:
    chat-skill.acarmisc.org/system-prompt-ref: ./SKILL.md
spec:
  type: chat-skill
  lifecycle: production
  owner: group:data-platform
```

| Annotation (`chat-skill.acarmisc.org/…`) | Meaning |
| --- | --- |
| `system-prompt-ref` | Path of the `SKILL.md`, relative to the entity's `backstage.io/managed-by-location`; read with the Backstage URL reader, so the host must be in your integrations |
| `system-prompt` | Inline prompt for one-liners (used when there is no `system-prompt-ref`) |
| `default-model` | Default model (falls back to the `SKILL.md` `model`) |
| `default-vector-stores` | Comma-separated knowledge base names (falls back to `vectorStores`) |

Title, description and tags come from the entity, falling back to the
`SKILL.md` frontmatter. Composed prompts are cached for about five minutes,
so edits show up without a redeploy.

## How the system prompt is built

For each turn the backend puts these system messages ahead of the
conversation; each is optional:

1. passages retrieved from the selected knowledge bases, numbered so the
   model can cite them as `[n]`;
2. one composed message: the skill's prompt, then tone, focus and verbosity
   (picked in **Tune**; short fixed instructions defined in the backend's
   `traits.ts` and referenced by id), then the user's extra instructions;
3. a web page added with `#https://…`, fetched by the backend and marked as
   untrusted reference material.

Reasoning effort is not part of the prompt: it is sent to LiteLLM as the
`reasoning_effort` parameter.
