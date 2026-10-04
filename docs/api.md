# Backend API

All routes are mounted under `/api/ai-conversation` and require a Backstage
user token (the frontend's `fetchApi` adds it). The browser never talks to
LiteLLM directly. Error responses are JSON `{ "error": "…" }`; messages coming
from LiteLLM have keys and bearer tokens redacted.

## Configuration and pickers

| Route | Description |
| --- | --- |
| `GET /health` | `{ "status": "ok" }` |
| `GET /config` | Defaults for the UI: `defaultModel`, `defaultVectorStoreIds`, `maxRequestBudget`, `excludedModels`, `persistence { enabled, ttlDays }`, `teamRequired` |
| `GET /vector_stores` | Knowledge bases from LiteLLM's vector store registry: `[{ id, name, … }]` |
| `GET /skills` | Skill metadata for the picker: `id`, `title`, `description`, `defaultModel`, `defaultVectorStoreIds`, `tags`. Never the prompt text |
| `GET /chat/traits` | Tone, focus and verbosity options: `{ tones, focuses, verbosities }`, each `[{ id, label }]` |

Teams and models come from the governance plugin's `/api/litellm/teams` and
`/api/litellm/models`.

## Conversation keys

| Route | Description |
| --- | --- |
| `POST /chat/key` | Mints a key for a conversation. Body `{ team_id?, max_budget?, models? }`. `team_id` must be one of the caller's LiteLLM teams (403 otherwise) and is required when `teamRequired` is on (400). `max_budget` is capped at `maxRequestBudget`. The key lives 3 hours. Returns `{ key, key_alias, expires_at, max_budget }` |
| `DELETE /chat/key` | Body `{ key }`. Deletes the key only if it is a chat key (`chat-…` alias) owned by the caller; 404 otherwise |
| `GET /chat/key/:alias/spend` | `{ spend, max_budget }` of one of the caller's chat keys |

## Chat

`POST /chat/stream/v2` streams one turn as an
[AI SDK UI message stream](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
(server-sent events).

```json
{
  "model": "gpt-4o",
  "messages": [{ "id": "m1", "role": "user", "parts": [{ "type": "text", "text": "…" }] }],
  "user_key": "sk-…",
  "thread_id": "…",
  "vector_store_ids": ["vs_…"],
  "top_k": 5,
  "skill_id": "component:default/data-analyst",
  "tone_id": "friendly",
  "focus_id": "actionable",
  "verbosity_id": "concise",
  "custom_system_prompt": "…",
  "reasoning_effort": "medium",
  "web_search": true,
  "context_url": "https://…"
}
```

| Field | Rules |
| --- | --- |
| `model` | Required, at most 200 characters |
| `messages` | Required, 1–200 messages with role `user`, `assistant` or `system` and a `parts` array; images as `file` parts (PNG, JPEG, WebP, GIF; at most 4 per message), only for models that accept images |
| `user_key` | Required, the conversation key from `POST /chat/key` |
| `vector_store_ids` | At most 20 |
| `top_k` | Integer 1–20 (default 5) |
| `reasoning_effort` | `low`, `medium` or `high` |

Besides text, the stream carries `data-citations` (retrieved passages, before
the first token) and `data-usage` (token counts). If retrieval fails, the
turn continues without grounding.

## Feedback and analytics

| Route | Description |
| --- | --- |
| `POST /feedback` | Records a thumbs up/down on an answer, with a snapshot of the question and answer; voting again updates the vote |
| `GET /feedback/summary` | Up/down totals; filters `?skillId=` and `?model=` |
| `GET /usage/summary` | Turn counts grouped by skill or model: `?groupBy=skill\|model&range=24h\|7d\|30d\|all` |

These summaries return aggregate counts only.

## Web page context

`POST /fetch-context` with `{ url }` fetches a public `https` page for the
composer's `#url` preview and returns its title and a snippet. Private,
loopback, link-local and metadata addresses are refused, also after
redirects; size and time are limited.

## Stored conversations

Only when `persistence.enabled` is on; otherwise 404. Every route only sees
the caller's own conversations.

| Route | Description |
| --- | --- |
| `GET /threads?limit=&offset=` | The caller's conversations, most recent first (default 200, at most 500) |
| `PUT /threads/:id` | Creates or updates a conversation: `{ title, pinned, data }`, `data` at most 1 MB. Keys are never stored |
| `DELETE /threads/:id` | Deletes one conversation |
