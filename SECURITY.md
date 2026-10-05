# Security

## Supported versions

Only the latest release of each package receives security fixes:

- `@acarmisc/backstage-plugin-ai-conversation`
- `@acarmisc/backstage-plugin-ai-conversation-backend`

## Reporting a vulnerability

Use GitHub's
[private vulnerability reporting](https://github.com/acarmisc/backstage-plugin-ai-conversation/security/advisories/new).
Please don't open a public issue. The project has one maintainer, so fixes are
best effort, without a response-time guarantee.

## Threat model

The backend holds the LiteLLM master key (`litellm.masterKey`, shared with the
governance plugin's configuration),
mints per-thread chat keys on behalf of Backstage users, and acts as a streaming
proxy to LiteLLM. Reports in these areas are most useful:

- **Master key isolation.** The LiteLLM master key is backend-only configuration
  and never reaches the browser. The LiteLLM client and identity helpers come
  from the governance plugin (`@acarmisc/backstage-plugin-litellm-backend`).

- **Per-thread chat key lifecycle.** `POST /chat/key` mints a short-lived `sk-`
  key (virtual key) via the master key, bound to a LiteLLM `team_id` (required
  when `litellm.aiConversation.teamRequired`). The key is returned once to the
  browser and stored in that thread's client-side state. Its `max_budget` is
  capped on the server at `litellm.aiConversation.maxRequestBudget`, whatever
  the client asks for. `DELETE /chat/key` only deletes chat keys (alias
  `chat-…`) that belong to the caller: the raw key is matched against the
  hashed tokens of the caller's own LiteLLM keys. The team binding ensures that budget, rate limits, and model ACLs
  are inherited from the team (LiteLLM enforces them at request time). If a key's
  budget runs out, LiteLLM rejects requests with a 429; the frontend catches this
  and surfaces an error banner. A key is deleted when the thread is deleted or
  the user switches teams.

- **RAG context injection (retrieval-augmented generation).** When `vector_store_ids`
  is non-empty, the backend searches each vector store (`POST
  /v1/vector_stores/{id}/search` to LiteLLM) and injects results as a system
  message before forwarding the request to LiteLLM's chat endpoint. Retrieval
  failures degrade gracefully — the turn proceeds ungrounded rather than failing.
  Retrieved snippets are passed through to the LLM without sanitization, so a
  malicious chunk in a vector store could reach the model; vector store access
  control is a LiteLLM concern.

- **Chat skill system prompts.** Skills are `chat-skill` Backstage catalog
  entities or bundled Markdown files. Server-side, `GET /skills` returns metadata
  only (id/title/description); the full system prompt text is resolved at request
  time by `skill_id` and prepended to the user's messages inside `/chat/stream/v2`.
  The prompt is never round-tripped through the browser and cannot be edited via
  localStorage tampering. Skill prompts are sourced from catalog annotations or
  Markdown files, both authored by catalog/repository admins.

- **`#url` context injection.** The composer accepts `#https://...` to fetch and
  inject page content as one-off context. The backend's `POST /fetch-context`
  implements an SSRF guard: the hostname is DNS-resolved and checked against
  private/loopback/link-local/metadata-address blocklists, with the check
  re-run on every redirect hop. **Known gap:** the DNS check occurs at resolution
  time only; if a hostname answers with a public IP on first lookup and an
  internal IP on the subsequent `fetch()`, the request proceeds. Closing this
  would require pinning the vetted address for the connection itself.

- **Attachment validation.** Image uploads are validated by MIME type and size
  before forwarding to LiteLLM. Non-multimodal models are rejected if an image
  is attached. Multimodal models are detected via a curated `multimodalModels`
  list (overridable per deployment).

- **Persisted thread storage.** When `litellm.aiConversation.persistence.enabled`
  is true, chat threads are persisted to the `chat_threads` table (user_ref +
  thread id as PK, opaque JSON `data`). Thread content is stored as plaintext at
  rest, relying on Postgres-level protections (network policy, disk encryption if
  configured). The `data` column excludes the live `keyToken` and `keyAlias`
  credentials (same exclusion as the `exportThread()` client-side export feature).
  Auto-deletion after `ttlDays` (default 30, `0` = unlimited) runs via the
  Backstage scheduler, not a plain interval, so it works correctly on multi-replica
  deployments.

- **Analytics endpoints.** `GET /feedback/summary` and `GET /usage/summary` return
  aggregate counts only (no message content, no per-user breakdown). Any
  authenticated Backstage user can reach these endpoints. **Known gap:** the `/ai-conversation/analytics`
  page itself is not admin-gated; that requires a permission-policy in the target
  Backstage app, outside the scope of this plugin.

- **Message feedback (thumbs up/down).** `POST /feedback` records user ratings
  and an optional Q&A snapshot for later analysis. Ratings are stored in
  `chat_message_feedback` as snapshotted events (thread_id/message_id/rating/snapshot),
  not full thread history.

- **CDN dependency.** The KaTeX stylesheet loads from `cdn.jsdelivr.net` at
  runtime, so the Content-Security-Policy must allow that origin. For an
  offline deployment the KaTeX CSS would need bundling (esbuild text loader).

- **Credentials in error responses.** Error messages sent to the browser have
  bearer tokens and `sk-` keys redacted and are truncated (same pattern as the
  governance plugin). Chat keys minted by the backend are returned once and not
  logged.

- **User identity and authorization.** All routes require a verified Backstage
  user credential (extracted via `auth.authenticate()`). User identity is
  resolved to a LiteLLM `user_id` via `resolveUserId()` and `toLiteLLMUserId()`
  from the govai backend. A requested `team_id` must be one of the caller's
  LiteLLM teams (read from LiteLLM `/user/info`), otherwise minting fails
  with 403.

## Security model

Everything the UI enforces is also enforced by the backend — the server is the
source of truth. A malicious client cannot:

- Use or delete a key belonging to another user (keys are scoped to the user who minted them).
- Call a model the team doesn't allow (LiteLLM enforces the team's model ACL).
- Exceed the team's rate limits or budget (enforced by LiteLLM via the team binding).
- Inject an arbitrary skill prompt (prompts are resolved server-side by id).
- Tamper with persisted thread history (stored server-side when enabled).
- Access another user's threads (queries are scoped to the authenticated user).
