# @acarmisc/backstage-plugin-ai-conversation-backend

Backend of [AI Conversation for Backstage](https://github.com/acarmisc/backstage-plugin-ai-conversation).
It mints a short-lived LiteLLM key per conversation, bound to one of the
user's teams, retrieves context from LiteLLM vector stores, adds skill and
style prompts on the server and streams the answer to the browser. It also
stores feedback, per-turn analytics and, optionally, conversations.

## Install

Requires the [LiteLLM Governance plugin](https://github.com/acarmisc/backstage-plugin-litellm-govai)
backend (`@acarmisc/backstage-plugin-litellm-backend`), installed and
configured with the same `litellm` block.

```bash
yarn --cwd packages/backend add @acarmisc/backstage-plugin-ai-conversation-backend
```

```ts
// packages/backend/src/index.ts
backend.add(import('@acarmisc/backstage-plugin-ai-conversation-backend'));
```

## Configuration

```yaml
litellm:
  baseUrl: http://litellm:4000
  masterKey: ${LITELLM_MASTER_KEY}
  aiConversation:
    defaultModel: gpt-4o
    maxRequestBudget: 5
    teamRequired: true
    persistence:
      enabled: false
      ttlDays: 30
```

Every key: [docs/configuration.md](https://github.com/acarmisc/backstage-plugin-ai-conversation/blob/main/docs/configuration.md).

## What it adds

- Routes under `/api/ai-conversation` ([API reference](https://github.com/acarmisc/backstage-plugin-ai-conversation/blob/main/docs/api.md)),
  all behind Backstage user authentication.
- Database tables `chat_message_feedback`, `chat_events` and `chat_threads`,
  created by its migrations on startup.
- A scheduled task that deletes stored conversations after `ttlDays`.
- Bundled skills (`code-reviewer`, `data-analyst`, `technical-writer`) and
  support for `chat-skill` catalog entities ([skills](https://github.com/acarmisc/backstage-plugin-ai-conversation/blob/main/docs/skills.md)).

Security model and known gaps: [SECURITY.md](https://github.com/acarmisc/backstage-plugin-ai-conversation/blob/main/SECURITY.md).
