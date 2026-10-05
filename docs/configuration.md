# Configuration

Everything lives under `litellm` in `app-config.yaml`. The connection keys are
the same ones the [LiteLLM Governance plugin](https://github.com/acarmisc/backstage-plugin-litellm-govai)
reads, so both plugins share one block. The schema is
[`config.d.ts`](../packages/plugin-ai-conversation-backend/config.d.ts).

## Full example

```yaml
litellm:
  baseUrl: http://litellm:4000
  masterKey: ${LITELLM_MASTER_KEY}
  userIdDomain: example.com

  aiConversation:
    defaultModel: gpt-4o
    defaultVectorStoreIds: [vs_engineering_handbook]
    maxRequestBudget: 5
    teamRequired: true
    excludedModels: ['claude-*', text-embedding-3-large]
    multimodalModels: [gpt-4o, gpt-4o-mini, claude-sonnet-4]
    persistence:
      enabled: true
      ttlDays: 30
    skills:
      sources:
        - type: bundled
        - type: catalog
```

## Shared with the governance plugin

| Key | Description |
| --- | --- |
| `litellm.baseUrl` | URL of the LiteLLM proxy, reachable from the Backstage backend. |
| `litellm.masterKey` | LiteLLM master key. Backend only; never sent to the browser. Used to mint and delete conversation keys and to look up the user's teams and keys. |
| `litellm.userIdDomain` | Domain appended to the Backstage user name to build the LiteLLM `user_id` (`user:default/jane.doe` → `jane.doe@example.com`). Must match the governance plugin. |

## `litellm.aiConversation`

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultModel` | string | — | Model selected for new conversations. A skill's default model overrides it. |
| `defaultVectorStoreIds` | string[] | — | Knowledge bases (LiteLLM vector store ids) selected for new conversations. |
| `maxRequestBudget` | number | — | USD budget of every conversation key. The backend caps whatever the browser asks for at this value; LiteLLM enforces it on the key, on top of the team budget. |
| `teamRequired` | boolean | `true` | Conversation keys must be bound to one of the caller's LiteLLM teams. Set to `false` to allow personal keys without a team. Keep it aligned with the governance plugin's `litellm.keyGeneration.teamRequired`. |
| `excludedModels` | string[] | — | Models hidden from the model picker. Case-insensitive exact names; a trailing `*` matches a prefix. Use it for models registered in LiteLLM that can't be called with a virtual key. |
| `multimodalModels` | string[] | name heuristic | Models that accept image attachments. Without it, a name-based guess is used; messages with images to other models are rejected with a clear error. |
| `persistence.enabled` | boolean | `false` | Store conversations in the plugin's database table `chat_threads`, so they follow the user across browsers. The browser keeps a local copy either way. |
| `persistence.ttlDays` | number | `30` | Delete stored conversations after this many days without activity. `0` keeps them forever. The cleanup runs on the Backstage scheduler, once across replicas. |
| `skills.sources` | `{ type }[]` | `bundled`, `catalog` | Where skills come from, in order of precedence. `bundled` reads `SKILL.md` folders shipped with the backend; `catalog` reads `chat-skill` Component entities. |
| `skills.bundledPath` | string | package `skills/` | Folder to read bundled skills from instead of the ones shipped with the package. |

## Things to decide before turning features on

- **Server-side storage** (`persistence.enabled`) stores full conversation
  text in your Backstage database, in plain text. There is no bulk "delete
  all my conversations" endpoint yet; retention is `ttlDays`. Treat enabling
  it as a data-governance decision.
- **Web search** is passed to LiteLLM as `web_search_options`. If no model
  in your proxy supports it, it does nothing.
- **Content Security Policy**: the page loads the KaTeX stylesheet from
  `cdn.jsdelivr.net`. Allow it, or LaTeX math renders unstyled.

## Database

The backend uses the plugin database Backstage gives it and runs its own
migrations on startup: `chat_message_feedback` (thumbs up/down with a Q&A
snapshot), `chat_events` (one row per turn: model, skill, grounded or not — no
message content) and `chat_threads` (only written when persistence is on).
