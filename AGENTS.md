# AGENTS.md — AI Conversation Plugin for Backstage

## Mission

Build a Backstage plugin that lets developers chat with LLM models through a LiteLLM proxy, grounded in knowledge bases stored in a pgvector vector store — with per-user governance (budget, model ACLs, rate limits) inherited automatically from the existing LiteLLM Governance plugin (`@acarmisc/backstage-plugin-litellm` / `@acarmisc/backstage-plugin-litellm-backend`, repo: `backstage-plugin-litellm-govai`).

The chat plugin is a **thin client** architecture: Backstage holds no RAG logic, no embeddings pipeline, no chunking, no reranker. LiteLLM owns the entire retrieval-augmented generation layer. Backstage is the UI + the streaming proxy + the identity bridge.

## Why this architecture

The govai plugin already solved the hard problems:

- **Backend-held master key** — the LiteLLM master key never reaches the browser.
- **Backstage identity → LiteLLM `user_id` resolution** — `resolveUserId(req, auth)` extracts the Backstage user entity ref from the request token; `toLiteLLMUserId(entityRef, userIdDomain)` maps it to a LiteLLM user_id (with optional email domain suffix).
- **Per-user virtual key minting** — `/keys/generate` creates `sk-` keys scoped to a user, with budget/tpm/rpm/model limits.
- **Autoprovisioning** — `getOrProvisionUser()` creates a LiteLLM user on first access if `litellm.provisioning.enabled` is true, with role-based overrides from Backstage group memberships.
- **Model catalogue proxying** — `/models` returns the LiteLLM proxy's model list, normalised to a `ModelInfo[]` shape.

The chat plugin reuses all of this by **importing from the govai package**, not duplicating it. The only genuinely new engineering is:

1. **SSE streaming proxy** — piping LiteLLM's Server-Sent Events stream through the Backstage Express backend to the browser without buffering.
2. **RAG invocation** — calling LiteLLM's `/v1/rag/query` (or `/v1/chat/completions` with `vector_store_ids`) with the user's selected vector store.
3. **Chat UI** — a streaming chat page with model/KB/key pickers, citation rendering, and client-side thread management.

## Key design decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Packaging | Separate plugin pair (`plugin-ai-conversation` + `plugin-ai-conversation-backend`) | Independently versionable; keeps governance and chat concerns decoupled; matches govai's monorepo pattern. |
| Thread persistence | Client-side ephemeral by default (React state + localStorage); **opt-in server-side persistence** via `litellm.aiConversation.persistence.enabled` (phase16) | LiteLLM is stateless — each turn resends full history anyway, so DB persistence was deferred until users actually asked for cross-device/durable history. Now available as an operator-controlled toggle: `chat_threads` table (`plugin-ai-conversation-backend/migrations/20260819130000_chat_threads.js`), `GET/PUT/DELETE /api/ai-conversation/threads[/:id]`, gated 404 when disabled. When enabled, the backend becomes authoritative — `useChat` loads the server's thread list on mount and syncs the active thread + create/delete/pin/import mutations back; localStorage is kept as a fast local cache/offline fallback either way. Auto-deletion after `ttlDays` (default 30, `0` = unlimited) runs via `coreServices.scheduler` (not a plain interval — DB-backed leader coordination matters here since the target deployment runs 2 Backstage replicas, see "Target environment" below). Message feedback (thumbs up/down) remains its own separate `chat_message_feedback` table/mechanism, a snapshotted event rather than full thread history. |
| RAG endpoint | `/v1/rag/query` primary, `/v1/chat/completions` + `vector_store_ids` fallback | `/v1/rag/query` is model-agnostic (prepend-context, not provider-native tool). Fallback handles LiteLLM versions where `/rag/query` isn't mounted. |
| Chat key strategy | Backend auto-mints a dedicated `sk-` key per thread via the master key (`POST /chat/key`), **bound to the user's selected LiteLLM team** (`team_id` — required when `litellm.aiConversation.teamRequired`, default true; validated against the caller's memberships), returned to the browser once and stored in that thread's state; deleted on thread delete or team switch | Superseded the original "user picks an existing key from a dropdown" plan — LiteLLM's `listKeys` only returns hashed/masked tokens, unusable for auth. See `HANDOFF.md` decision #3. Team binding is what makes budget/rate-limit/model-ACL work: LiteLLM resolves all three from `team_id`, so Backstage never has to mirror the governance rules — it only filters the pickers so users can't select something the proxy will reject. Mirrors govai's own key-generation flow (`KeyFormDialog` + `/teams` + opencode-connect's team guard). |
| UI surfaces | Full chat page at `/ai-conversation` | v1 ships the page. Sidebar modal and home widget are future work. |
| Cross-package reuse | Import `LiteLLMClient`, `resolveUserId`, `toLiteLLMUserId`, `getOrProvisionUser`, `ProvisioningError`, types from govai backend; import `LiteLlmApi`, `liteLlmApiRef`, types from govai frontend | Govai is the single source of truth for identity, key management, and the LiteLLM client. Chat plugin adds only chat-specific routes and components. |
| Skill source | Backstage catalog `Component` entities (`spec.type: chat-skill`), own type — not `app-config.yaml`, not the sibling `ai-agent` type. Bundled SKILL.md directories are the zero-config fallback. | Self-service authoring (any team commits a `catalog-info.yaml`), ownership/RBAC/tags for free. `ai-agent` models externally-invocable, health-probed agents; a skill has no endpoint to probe and would pollute that inventory with permanent `unknown` status. Skill authoring lives in `git@gitlab.az.abssrv.it:innovation/ces-ai-personas.git` (legacy repo name), auto-discovered by the existing GitLab catalog provider — no host app-config change needed. |
| Skill system-prompt resolution | Server-side, by `skill_id` (catalog entity ref, or a `skill:bundled/<slug>` id) | `/skills` returns picker metadata only (title/description/defaults) — never the system-prompt text. The backend resolves the full entity and prepends the prompt as a system message inside `/chat/stream/v2`, so the prompt never round-trips through the browser and can't be edited via localStorage tampering. The prompt comes from either an inline `chat-skill.acarmisc.org/system-prompt` annotation (legacy, one-liners) or a `system-prompt-ref` pointing at a Markdown `SKILL.md` — fetched via `UrlReaderService` relative to the entity's `backstage.io/managed-by-location`, frontmatter stripped, and `{{include: <path>}}` directives expanded recursively (cycle- and depth-guarded) into one composed prompt (`ref` wins over inline). Composed prompts are cached in-memory for 5 min. See `skills.ts`. |
| Tone / Focus / Verbosity / Reasoning effort | Fixed in-code option lists (`traits.ts`), not catalog entities; composed as extra system-prompt layers via `composeSystemPrompt`, orthogonal to skill/model/KB (same as those, defaults can be prefilled but never locked) | A skill bundling tone+focus+knowledge into one opaque prompt would force a combinatorial catalog (`formal-hr-expert`, `casual-hr-expert`, …) to cover every combination a user might want. Splitting tone/focus out as independently-selectable layers avoids that (order: skill → tone → focus → verbosity → custom, each layer optional, with the ad-hoc `#url` context inserted after all of them — see `applyUrlContext`). Unlike skills, these are a small (~5 option), slowly-changing, curated vocabulary — same shape as ChatGPT's "custom instructions" traits — so a catalog entity kind would be over-engineering; a static list is proportionate and still only ever exposes `id`/`label` to the browser via `/chat/traits`, with the prompt text resolved server-side by id (same anti-tampering reasoning as the skill prompt). Reasoning effort is different in kind — a native `reasoning_effort` param forwarded as-is to LiteLLM (not composed into the prompt), since it's a real API parameter, not a style instruction; only sent when the user picks a level, so models that don't support it see no change in behavior. |

## Target environment (GKE)

- **Cluster**: `gke_abs-digital-playground_europe-west1_abs-ces-n8n`
- **LiteLLM proxy**: `http://litellm.litellm.svc.cluster.local:4000` (namespace `litellm`, image `docker.litellm.ai/berriai/litellm-database:v1.90.0`, 1 replica)
- **pgvector service**: `http://litellm-pgvector.litellm.svc.cluster.local:8000` (namespace `litellm`, image `europe-west1-docker.pkg.dev/abs-digital-playground/containers/litellm-pgvector:768-v1`, embeddings via `openai/nomic-embed-text` at 768 dimensions, auth via `PG_VECTOR_API_KEY`)
- **Redis**: `litellm-redis.litellm.svc.cluster.local:6379` (exact-match response cache, TTL 3600s)
- **Vector stores**: DB-backed in LiteLLM (not in `config.yaml`). Registered via `scripts/register-vector-store.sh`. LiteLLM resolves vector-store search from the DB registry at query time.
- **Backstage**: namespace `backstage`, 2 replicas, image `europe-west1-docker.pkg.dev/abs-digital-playground/ces-innovation/ces-backstage:<sha>`, port 7007, Postgres at `backstage-postgres.backstage.svc.cluster.local:5432`
- **Auth**: Keycloak OIDC, realm `solution-innovation`, issuer `https://auth.ces.abssrv.it/realms/solution-innovation`
- **LiteLLM config**: `store_model_in_db: true` (models managed via REST/UI, not config.yaml), `forward_client_headers_to_llm_api: true`, `drop_params: true`, OTEL callbacks enabled, `cache: true` on Redis

## Existing govai plugin — what's exported and reusable

### Backend (`@acarmisc/backstage-plugin-litellm-backend`)

| Export | What it does |
|---|---|
| `LiteLLMClient` | Class wrapping LiteLLM REST API with master-key auth. Methods: `getUserInfo`, `createUser`, `updateUser`, `listKeys`, `generateKey`, `updateKey`, `deleteKeys`, `regenerateKey`, `listModels`, `getTeamInfo`, `getUsage`, `getTeamUsage`. **JSON-only** — does not support streaming. |
| `resolveUserId(req, auth)` | Extracts Backstage user entity ref from request Bearer token via `auth.authenticate()`. Returns `string \| undefined`. |
| `toLiteLLMUserId(entityRef, userIdDomain)` | Maps `user:default/john.doe` + `example.com` → `john.doe@example.com`. Handles already-email-shaped entity names. |
| `getOrProvisionUser(...)` | Ensures a LiteLLM user exists, provisioning from catalog profile + role overrides if enabled. Single-flight cache prevents thundering herd. Throws `ProvisioningError` on failure. |
| `ProvisioningError` | Error class with `status` and `body: {error, hint, provisioning}`. Map upstream LiteLLM errors to this for consistent browser-facing error shape. |
| `readProvisioningDefaults(config)` | Reads `litellm.provisioning.*` config block. |
| `readRoleConfigs(config)` | Reads `litellm.provisioning.roles[]` array. |
| `KeycloakJWTVerifier`, `newDefaultVerifier`, bridge functions | CLI bridge auth — **not needed for chat v1** (chat is browser-only, uses Backstage auth). |
| Types: `LiteLLMConfig`, `UserInfo`, `VirtualKey`, `ModelInfo`, `GenerateKeyRequest`, `GenerateKeyResponse`, etc. | Shared type definitions. |

### Frontend (`@acarmisc/backstage-plugin-litellm`)

| Export | What it does |
|---|---|
| `liteLlmApiRef` | `createApiRef` for the governance API. The chat plugin reuses this to call `/keys` and `/models` — no duplication. |
| `LiteLlmApi` | API client class. Methods: `getUserInfo`, `listKeys`, `generateKey`, `updateKey`, `deleteKey`, `listModels`, `getTeams`, `getUsage`, `getTeamUsage`. Base path `/api/litellm`. |
| `litellmPlugin` | The frontend plugin (registers the `/litellm` page + API). The chat plugin is a **separate** plugin that coexists. |
| Types: `UserInfo`, `VirtualKey`, `ModelInfo`, etc. | Shared type definitions. |

## New plugin: backend (`@acarmisc/backstage-plugin-ai-conversation-backend`)

### Routes (all under `/api/ai-conversation`, all Backstage-auth-authenticated)

| Route | Method | Purpose |
|---|---|---|
| `/health` | GET | `{ status: 'ok' }` |
| `/config` | GET | Chat defaults for the UI: `defaultModel`, `defaultVectorStoreIds`, `maxRequestBudget`, `excludedModels`, `persistence`, `teamRequired`. |
| `/vector_stores` | GET | Lists LiteLLM vector stores for the KB picker. Calls LiteLLM's `/v1/vector_store/list`. |
| `/skills` | GET | Lists chat skills (metadata only — id/title/description/defaultModel/defaultVectorStoreIds/tags). No system-prompt text. |
| `/chat/traits` | GET | Static tone/focus/verbosity option lists for the pickers (id/label only — see `traits.ts`). |
| `/chat/key` | POST/DELETE | Mints / deletes a per-thread `sk-` chat key via the master key. Bound to a `team_id` (required when `teamRequired`; validated against the caller's own LiteLLM teams → 403 otherwise) so budget, rate limits and model ACL are inherited from the team. |
| `/chat/key/:alias/spend` | GET | Current spend/budget for a chat key, looked up by alias. |
| `/fetch-context` | POST | SSRF-guarded fetch + extract for the composer's `#url` chip (title/snippet only). |
| `/feedback` | POST | Upserts a thumbs-up/down vote (with a Q&A snapshot) on an assistant message. |
| `/feedback/summary` | GET | Aggregate up/down counts for the analytics page. |
| `/usage/summary` | GET | Turn counts grouped by skill or model (`?groupBy=skill|model&range=`). |
| `/chat/stream/v2` | POST | Streaming chat proxy, AI SDK UI Message Stream Protocol response. The sole chat-streaming route — the pre-migration raw-SSE `/chat/stream` and non-streaming `/chat/completions` routes were removed once the frontend fully moved onto this one. Accepts optional `skill_id`, `tone_id`, `focus_id`, `verbosity_id` (composed server-side into one system message, in that order, skill first — see `composeSystemPrompt` in `router.ts`), and `reasoning_effort` (`low`\|`medium`\|`high`, forwarded to LiteLLM as-is, not composed into the prompt). |
| `/threads` | GET | Lists the authenticated user's persisted threads (`?limit=&offset=`, capped at 500). 404 when `litellm.aiConversation.persistence.enabled` is false. |
| `/threads/:id` | PUT | Upserts a thread (title/pinned/data — `data` is opaque JSON, size-capped at 1MB). 404 when persistence is disabled. |
| `/threads/:id` | DELETE | Deletes one persisted thread, scoped to the authenticated user. 404 when persistence is disabled. |

### `/chat/stream/v2` request body (from browser)

```json
{
  "model": "claude-3-5-sonnet",
  "messages": [{ "id": "m1", "role": "user", "parts": [{ "type": "text", "text": "..." }] }],
  "vector_store_ids": ["vs_pgvec_xxx"],
  "top_k": 5,
  "skill_id": "component:default/data-analyst",
  "tone_id": "friendly",
  "reasoning_effort": "medium",
  "user_key": "sk-..."
}
```

`messages` is AI SDK `UIMessage[]`-shaped (parts, not a flat `content`
string) so attachments travel as `file` parts. See `attachments.ts`.

### `/chat/stream/v2` backend flow

1. `resolveUserId(req, auth)` — confirm identity (no provisioning required
   for chat; the chat key must already have been minted via `/chat/key`).
2. Validate attachments (mime/size/count) and reject non-multimodal models
   for image-bearing requests (`attachments.ts`).
3. Best-effort `chat_events` insert for analytics (never blocks the turn).
4. Compose the system-prompt layers — skill → tone → focus → verbosity →
   custom (`composeSystemPrompt`), then prepend any `#url` context
   (`applyUrlContext`). The user's own messages are converted to
   OpenAI-shaped content via `toOpenAIMessageContent`.
5. Retrieval, when `vector_store_ids` is non-empty (`rag.ts`): `POST
   /v1/vector_stores/{id}/search` per store with the Bedrock
   `managedSearchConfiguration` form, retried bare on a 400 for
   non-Bedrock stores. Results are injected as one numbered system message
   (`buildContextMessage`). A retrieval failure degrades to ungrounded chat
   rather than failing the turn.
6. `proxyUIMessageStream` (`uiMessageStream.ts`) fetches
   `POST {LITELLM_BASE_URL}/v1/chat/completions` with `stream: true` and
   re-emits it as an AI SDK UI Message Stream Protocol response. Retrieval
   results are written as a `data-citations` prelude chunk before the first
   token.

Timeout handling is split deliberately: a 30s *connect* timer (cleared once
headers arrive) and a 120s *idle* timer reset on every chunk. A single
`AbortSignal.timeout` over the whole request would abort the body stream and
cut off long generations mid-answer.

### Config schema (`config.d.ts`)

Reads the same `litellm.baseUrl` / `litellm.masterKey` / `litellm.userIdDomain` / `litellm.provisioning.*` that govai defines. One optional addition:

```yaml
litellm:
  aiConversation:
    defaultModel: claude-3-5-sonnet        # optional, pre-selected in UI
    defaultVectorStoreIds: []               # optional, pre-selected in UI
    maxRequestBudget: 5                     # optional, USD cap applied to each minted chat key
    teamRequired: true                      # optional, default true — chat keys must bind to a team
    excludedModels: ["claude-*"]            # optional, hidden from the model picker (prefix: *)
    multimodalModels:                       # optional, overrides the vision heuristic
      - gpt-4o
    persistence:                            # optional (phase16), off by default
      enabled: false                        # persist chat threads server-side instead of browser-only
      ttlDays: 30                           # auto-delete threads after N days of inactivity; 0 = unlimited
```

### Plugin registration

```typescript
createBackendPlugin({
  pluginId: 'ai-conversation',
  register(reg) {
    reg.registerInit({
      deps: { httpRouter, config, logger, auth, catalog, database, urlReader, scheduler },
      async init({ httpRouter, config, logger, auth, catalog, database, urlReader, scheduler }) {
        const router = await createRouter({ config, logger, auth, catalog, database, urlReader, scheduler });
        httpRouter.use(router);
      },
    });
  },
});
```

No `addAuthPolicy` overrides — all routes use Backstage auth (no Keycloak bridge for chat in v1).

## New plugin: frontend (`@acarmisc/backstage-plugin-ai-conversation`)

### API client (`src/api.ts`)

New `AiConversationApi` + `aiConversationApiRef`. Reuses the existing `liteLlmApiRef` from govai for `/keys` and `/models`.

| Method | Purpose |
|---|---|
| `listVectorStores()` | `GET /api/ai-conversation/vector_stores` → `VectorStore[]` |
| `chatCompletions(req)` | Non-streaming variant. Streaming goes through `useThreads`'s `@ai-sdk/react` transport, not a hand-rolled `api.ts` method (see below). |

### Types (`src/types.ts`)

```typescript
interface VectorStore { id: string; name: string; file_count?: number; status?: string; }
interface ChatRequest { model: string; messages: Message[]; vector_store_ids?: string[]; top_k?: number; user_key: string; }
interface Message { role: 'user' | 'assistant' | 'system'; content: string; }
interface ChatResult { content: string; citations: Citation[]; }
interface Citation { filename: string; score: number; snippet: string; }
```

### State management (`src/hooks/useThreads.ts`)

Replaced the original hand-rolled `useChat.ts` (manual SSE reader, abort-per-message map, truncate-and-resend logic) with the [Vercel AI SDK](https://ai-sdk.dev)'s `@ai-sdk/react` `useChat` as the streaming/state engine — see `HANDOFF-ai-sdk-migration.md` for the full migration writeup.

- `threads: Thread[]` in `useState`, persisted to `localStorage` under `ai-conversation:threads:<userId>` (or server-side via `chat_threads` when `litellm.aiConversation.persistence.enabled`).
- `Thread.messages` is now `AiConversationUIMessage[]` (the AI SDK's `UIMessage` shape — typed `parts`: text/file/tool-call/`data-citations`/`data-usage` — not a flat `content: string`), enabling attachments and per-message citations/usage.
- One `@ai-sdk/react` `useChat` instance per active thread, pointed at `POST /api/ai-conversation/chat/stream/v2` (server-side AI SDK UI Message Stream Protocol — see `uiMessageStream.ts`). Compare mode runs N concurrent instances, one per selected model, coordinated by `runCompareSend`.
- `useThreads` exposes: `threads`, `activeThread`, `newThread()`, `selectThread(id)`, `deleteThread(id)`, `sendMessage(text, attachedUrl?, compareModelsOverride?, files?)`, `regenerateFrom(id)`, `editAndResend(id, text)`, `stopGeneration()`, `exportThread`/`importThread`, `togglePin`, `submitFeedback`.
- Attachments: the composer converts a `FileList` to `FileUIPart[]` via the SDK's `convertFileListToFileUIParts` and passes it through `sendMessage`'s `files` parameter; the backend (`attachments.ts`) validates mime/size/count and rejects non-multimodal models before forwarding to LiteLLM as `image_url` content parts.

### Components

| Component | Responsibility |
|---|---|
| `ChatPage` | Page shell at `/ai-conversation`. Owns settings/thread/key state; composes the sidebar, message area and right rail. |
| `ThreadSidebar` | Left rail: collapsible settings panel (via `ChatSettingsPanel`), new/import actions, searchable thread history with per-thread menu (pin/export/delete). |
| `ChatComposer` | Attachment button, staged-file / `#url` chips, textarea, send/stop button. |
| `ChatSettingsPanel` | Skill/Team/Model/KB pickers, extra prompt, and the Advanced accordion (Tone/Focus/Verbosity/Reasoning effort/Web search). |
| `SkillPicker` | Dropdown of `chat-skill` catalog entities (or bundled skills) from `listSkills()`. Selecting one prefills `ModelPicker`/`VectorStorePicker` from its defaults and sends `skill_id` with the request. |
| `OptionPicker` | Generic small Select (label + options + onChange), shared by Tone/Focus/Verbosity (options from `getChatTraits()`) and Reasoning effort (fixed `low`/`medium`/`high`, no backend call). |
| `TeamPicker` | Dropdown from `liteLlmApiRef.getTeams()` (govai's route, already scoped to the caller's teams). Required when `config.teamRequired`. Selecting a team re-mints the chat key bound to it, prefills the team's KBs, and re-scopes `ModelPicker` to the team's model allowlist. |
| `ModelPicker` | Dropdown from `liteLlmApiRef.listModels()` (the global catalogue, master-key-backed — same as govai). Preselects `config.defaultModel`; hides `config.excludedModels`; when a team is selected, narrows to that team's `models` allowlist (literal names, `access_groups`, or the `all-proxy-models` sentinel) via `filterModelsByTeam` in `modelFilter.ts`. |
| `VectorStorePicker` | Multi-select from `listVectorStores()`. Empty selection = no grounding. Preselects `config.defaultVectorStoreIds`, then the selected team's `object_permission.vector_stores` (still editable). Team stores absent from the global listing are merged in as id-labeled options. |
| `MessageList` | Groups messages into turns; renders compare-mode turns as side-by-side columns. |
| `AssistantMessage` / `UserMessage` | Per-role rendering, markdown, message actions (feedback/regenerate/copy, edit-and-resend). |
| `SourcesPanel` | Right-rail. Latest turn's citations, deduped and grouped KB vs Web. |
| `UsagePanel` | Right-rail. Per-turn and session token counts, plus the thread's chat key spend/budget. |
| `ErrorBanner` | Stream error or fetch failure (e.g. 401 from LiteLLM — key out of budget). |

### Plugin registration

```tsx
const liteLlmChatApi = ApiBlueprint.make({
  params: defineParams => defineParams({
    api: aiConversationApiRef,
    deps: { fetchApi: fetchApiRef },
    factory: ({ fetchApi }) => new AiConversationApi(fetchApi),
  }),
});

const chatPage = PageBlueprint.make({
  params: {
    path: '/ai-conversation',
    title: 'AI Chat',
    icon: <ChatIcon />,
    loader: async () => (await import('./components/ChatPage')).ChatPage,
  },
});

export const aiConversationPlugin = createFrontendPlugin({
  pluginId: 'ai-conversation',
  extensions: [liteLlmChatApi, chatPage],
});
```

## Repository structure

```
backstage-plugin-ai-conversation/
├── package.json                           # monorepo root
├── AGENTS.md                              # this file
├── todo.txt                               # phased task list
├── README.md
└── packages/
    ├── plugin-ai-conversation/               # @acarmisc/backstage-plugin-ai-conversation
    │   ├── package.json
    │   ├── build.js
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── plugin.tsx
    │       ├── api.ts
    │       ├── types.ts
    │       ├── safeUrl.ts
    │       ├── theme.ts
    │       ├── hooks/
    │       │   ├── useThreads.ts              # thread state + streaming orchestration
    │       │   ├── useThreadPersistence.ts    # localStorage + server sync plumbing
    │       │   ├── useCompareChat.ts          # N parallel Chat instances (compare mode)
    │       │   ├── useUrlContext.ts           # `#url` preview resolution
    │       │   ├── useStagedFiles.ts          # attachment staging
    │       │   ├── useResizablePanel.ts
    │       │   ├── threadPersistence.ts       # shape mapping + migration
    │       │   ├── aiSdkTransport.ts
    │       │   ├── chatTruncation.ts
    │       │   └── messageShape.ts
    │       └── components/
    │           ├── ChatPage.tsx
    │           ├── ThreadSidebar.tsx
    │           ├── ChatComposer.tsx
    │           ├── ChatSettingsPanel.tsx
    │           ├── MessageList.tsx
    │           ├── AssistantMessage.tsx
    │           ├── UserMessage.tsx
    │           ├── ModelPicker.tsx
    │           ├── TeamPicker.tsx
    │           ├── VectorStorePicker.tsx
    │           ├── SkillPicker.tsx
    │           ├── OptionPicker.tsx
    │           ├── SourcesPanel.tsx
    │           ├── UsagePanel.tsx
    │           ├── AnalyticsPage.tsx
    │           ├── BarList.tsx
    │           ├── CodeBlock.tsx
    │           ├── ErrorBanner.tsx
    │           ├── StreamingAvatar.tsx
    │           └── modelFilter.ts
    └── plugin-ai-conversation-backend/       # @acarmisc/backstage-plugin-ai-conversation-backend
        ├── package.json
        ├── build.js
        ├── config.d.ts
        ├── tsconfig.json
        ├── migrations/
        ├── skills/                        # bundled SKILL.md dirs
        └── src/
            ├── index.ts
            ├── plugin.ts
            ├── router.ts                  # all HTTP routes
            ├── uiMessageStream.ts         # SSE proxy + AI SDK UI Message Stream adapter
            ├── rag.ts                     # two-step retrieval + context injection
            ├── attachments.ts             # image validation + OpenAI content mapping
            ├── skills.ts                  # bundled + catalog skill sources
            ├── traits.ts                  # tone/focus/verbosity registries
            ├── urlContext.ts              # SSRF-guarded `#url` fetch
            ├── persistence.ts             # chat_threads CRUD + TTL purge
            └── types.ts
```

## Phases (see todo.txt for granular tasks)

1. **Scaffold** — both packages, package.json, tsconfig, build.js, config.d.ts, stubs. Link in target Backstage monorepo.
2. **Verify LLM** — confirm `/v1/rag/query` exists on v1.90.0, confirm `/v1/chat/completions` + `vector_store_ids` fallback shape, confirm `/v1/vector_stores` returns pgvector stores, verify SSE passthrough through Backstage's `HttpRouterService`.
3. **Backend stream** — `uiMessageStream.ts`: SSE parsing, AI SDK UI Message Stream Protocol adaptation, connect/idle timeouts, client disconnect.
4. **Backend router** — `/health`, `/vector_stores`, `/chat/stream/v2`. Import govai machinery. Plugin registration.
5. **Frontend API** — `AiConversationApi`, types, SSE reader, `AbortController`.
6. **Frontend hooks** — `useChat` thread state, localStorage, `sendMessage`, `stopGeneration`.
7. **Frontend UI** — all components, pickers, plugin registration, exports.
8. **Integration** — wire into target Backstage, deploy to GKE, verify against live pgvector.
9. **Skills** — `GET /skills` (catalog `chat-skill` entities + bundled SKILL.md dirs), server-side system-prompt injection, `SkillPicker` frontend component, vector-store name→id resolution. See `ces-ai-personas` repo for the catalog data.
10. **Design system + message actions** — accent gradient (violet→cyan) streaming ring on the model avatar (the one persistent animated element, tied to real streaming state, `prefers-reduced-motion`-aware), JetBrains Mono for code, `AssistantMessage`/`UserMessage` split (no-bubble sunken-surface treatment for user turns), collapsible sidebar/context-panel. Regenerate/edit-and-resend (`useThreads.regenerateFrom`/`editAndResend`, both truncate-and-resend through a shared `runSend`), copy message/code-block.
11. **Export/import + search/pin** — `useChat.exportThread`/`importThread` (portable JSON, deliberately excludes the live chat key), sidebar search (title + message content), `pinned` field with pinned-first sort.
12. **LaTeX + `#url` context** — `remark-math`/`rehype-katex` in the markdown pipeline (KaTeX CSS loaded via runtime `<link>`, not bundled — the esbuild pipeline has no CSS loader). `#https://...` in the composer resolves via `POST /fetch-context` (SSRF-guarded: https-only, DNS-resolved private/loopback/link-local/metadata-address blocking re-checked on every redirect hop, timeout, response-size cap — see `urlContext.ts`); the fetched page is injected server-side as one-off context, never round-tripping the full text through the browser.
13. **Multi-model compare** — per-thread `mode: 'single' | 'compare'`; compare mode streams the same prompt to several models in parallel (`runCompareSend`), each into its own message sharing a `turnId`, rendered as side-by-side columns. Required moving `useChat` off a single global `AbortController`/`isStreaming` flag onto a `Map<messageId, AbortController>` plus a `streamingMessageIds` set.
14. **Web search toggle** — passes `web_search` through as LiteLLM's `web_search_options` alongside (not instead of) any selected knowledge bases; sources panel labels results Web vs Knowledge base by a `url`-field heuristic (LiteLLM doesn't tag result origin explicitly). Assumes the target LiteLLM deployment has a native web-search-capable model — **unverified against the live proxy**, see the "Known gaps" note below.
15. **Analytics dashboard** — `chat_events` migration + best-effort per-turn logging (thread_id/user_ref/model/persona_id/grounded, not message content), `GET /feedback/summary` + `GET /usage/summary?groupBy=skill|model&range=`, `/ai-conversation/analytics` page with hand-rolled bar charts (no new charting dependency). The summary endpoints return aggregate counts only, so they're reachable by any authenticated user — genuine admin-only *page* access requires a permission-policy in the target Backstage app, which this repo doesn't own (see "Known gaps"). Note the `persona_id` column name is legacy: the API field is `skillId` on both sides (the frontend previously sent `personaId`, which silently nulled every row — fixed).
16. **Opt-in server-side thread persistence** — `chat_threads` migration (`id`+`user_ref` composite PK, opaque JSON `data` column) behind `litellm.aiConversation.persistence.enabled` (default `false`). `GET/PUT/DELETE /api/ai-conversation/threads[/:id]`, each 404ing when persistence is off. `data` is never interpreted server-side — it's the frontend's `Thread` shape minus the live `keyToken`/`keyAlias` credential (same exclusion `exportThread()` already applied — see `hooks/threadPersistence.ts`'s `toSaveThreadBody`/`fromPersisted`), size-capped at 1MB per thread (`persistence.ts`). `useThreads` treats the backend as authoritative once enabled: loads the server's list on mount and syncs the active thread on the same 400ms debounce that already drives the localStorage write; localStorage keeps writing regardless, as an offline cache/fallback. `GET /threads` is paginated (`?limit=&offset=`, default 200 / max 500). All the sync plumbing lives in `hooks/useThreadPersistence.ts`. Auto-deletion after `ttlDays` (default 30, `0` = unlimited) runs via `coreServices.scheduler`, not a plain `setInterval` — the target deployment runs 2 Backstage replicas (see "Target environment"), and the scheduler service's DB-backed task locking is what keeps the sweep from running twice per tick.

## Things NOT in v1

- **Bridge/CLI auth for chat** — chat is browser-only. The govai Keycloak bridge is for key minting by the Abby CLI.
- **Custom chunking/reranker/hybrid search** — LiteLLM's `retrieval_config` gives `top_k` and optional rerank. If fine-grained retrieval control is needed later, build a dedicated retrieval service.
- **Sidebar modal / home widget** — v1 ships the `/ai-conversation` page only.

## Known gaps (phase10-16)

- **Team scoping degrades silently against an old govai release.** The frontend consumes `TeamInfo.object_permission.vector_stores` and `ModelInfo.access_groups` structurally (see `ChatTeamInfo` in `types.ts`) rather than importing govai's types, because this repo's `^0.4.0` dependency predates both fields (govai's sibling repo is at 0.26.0). On an old govai: the model picker simply doesn't narrow by team (models are still enforced by LiteLLM via `team_id` at request time — the picker just offers more than the team can call) and no KBs are preselected. Bumping the govai dependency would let the types be imported directly; the structural shim is what keeps the two packages independently installable meanwhile.
- **`teamRequired` is a separate knob from govai's.** `litellm.aiConversation.teamRequired` (default true) mirrors govai's `litellm.keyGeneration.teamRequired` but is read from this plugin's own config, so the two must be kept aligned by the operator — setting one and not the other leaves the chat and governance surfaces disagreeing about whether a team is mandatory.

- **`/ai-conversation/analytics` is not actually admin-gated.** The endpoints it reads (`GET /feedback/summary`, `GET /usage/summary`) only ever return aggregate counts — no message content, no per-user breakdown — so the exposure is low, but nothing in this repo restricts the *page* to admins. That requires a permission-policy in the target Backstage app (same category of change as the sidebar nav entry / route registration already documented under "Files changed in target Backstage" in HANDOFF.md), which this repo doesn't own.
- **`web_search` (phase14) assumes LiteLLM has a native web-search-capable model/tool** reachable via `web_search_options` on `/v1/chat/completions`. Unverified against the live proxy — if the target deployment doesn't have one, the flag is a silent no-op upstream rather than an error. If that turns out to be the case, the fallback plan (self-hosted SearXNG, integrated server-side with its own citations) is a materially bigger job — see the original feature plan's phase14 estimate split (~2 days vs ~1-1.5 weeks).
- **The `#url` SSRF guard checks addresses at DNS-resolution time, not at connect time.** `assertPublicHostname` resolves the host and rejects private/loopback/link-local/metadata addresses (re-checked on every redirect hop), but the `fetch()` that follows resolves the name again independently — a host that answers with a public address on the first lookup and an internal one on the second would slip through. Closing that means pinning the vetted address for the actual connection (an undici `Agent` with a custom `connect.lookup`), deferred. The straightforward attacks — an internal hostname, an IP literal in any of its textual spellings, or a redirect to either — are blocked, and `isBlockedAddress` is unit-tested against the non-canonical IPv6 forms specifically.
- **KaTeX CSS and the JetBrains Mono webfont load from public CDNs at runtime** (`theme.ts`), because the esbuild pipeline has no CSS loader. Besides the CSP entries that needs, it makes the chat page depend on `cdn.jsdelivr.net`/`fonts.googleapis.com` being reachable from the browser — worth bundling the KaTeX CSS (esbuild `text` loader → injected `<style>`) if the target deployment is ever locked down.
- **`#url` extraction (phase12) is regex-based HTML stripping**, not a DOM parser — deliberately avoids adding `jsdom`/`@mozilla/readability` as new dependencies. Good enough for typical article/doc pages; will do worse than a real reader-mode extractor on heavily scripted or non-semantic-HTML pages.
- **Compare mode (phase13) shares one `citations`/`lastTurnUsage` slot across all columns** — whichever model's stream reports search results or usage last "wins" in the sources/usage panels. A real per-column breakdown would need those to become keyed by message id, deferred since it's cosmetic, not a correctness issue. Compare mode also reaches into `@ai-sdk/react`'s private `Chat` subscription callbacks (no public API exists); `useCompareChat` probes for them and surfaces `compareUnavailable` if a future SDK renames them, rather than failing silently.
- **Web vs Knowledge base citation labeling (phase14) is a heuristic** (`url` field present ⇒ web), not something LiteLLM tags explicitly — verify against real web-search response shapes before trusting the label in the UI.
- **Persisted thread content (phase16) is plaintext at rest**, relying on Postgres-level protections (network policy, disk encryption if configured) rather than any application-level encryption — same trust boundary as `chat_message_feedback`/`chat_events`, but now covering full message content instead of aggregate/snapshot data. There's also no bulk "delete all my threads" endpoint yet (only per-thread `DELETE /threads/:id`); a full-account erasure request currently means either waiting out `ttlDays` or an operator running a manual `DELETE FROM chat_threads WHERE user_ref = ...`. Turning `persistence.enabled` on is a deliberate data-governance decision for the operator, not just a feature flag — see the plugin's chat-history-persistence design discussion for the full pros/cons.

## Build and test

```bash
# From this repo's root
yarn build        # esbuild bundle + tsc for both packages
yarn lint
yarn test         # jest for both packages (--watch=false)

# Or per workspace
yarn workspace @acarmisc/backstage-plugin-ai-conversation build
yarn workspace @acarmisc/backstage-plugin-ai-conversation-backend build
yarn workspace @acarmisc/backstage-plugin-ai-conversation test
yarn workspace @acarmisc/backstage-plugin-ai-conversation-backend test
```

CI runs `yarn lint`, `yarn test` and `yarn build` on every push/PR
(`.github/workflows/ci.yml`). `dist/` is build output and is not committed.

## Release

Same tag pattern as govai:

```bash
git tag ai-conversation@X.Y.Z          # or ai-conversation-backend@X.Y.Z
git push origin ai-conversation@X.Y.Z
```

CI verifies tag version matches `package.json`, builds, publishes to npm, creates GitHub Release.

## Reference repos

- **govai plugin** (sibling): `/Users/andrea/Projects/personal/backstage-plugin-litellm-govai`
  - Frontend: `packages/plugin-litellm/` — this plugin's dependency range is `^0.4.0`, but the sibling repo has moved on to `0.26.0` (see the team-scoping gap above)
  - Backend: `packages/plugin-litellm-backend/` — dependency range `^0.3.4`, sibling at `0.15.0`
- **This plugin**: `/Users/andrea/Projects/personal/backstage-plugin-ai-conversation`

## Open questions to verify during phase 2

1. Does `/v1/rag/query` exist on LiteLLM v1.90.0? If not, the fallback to `/v1/chat/completions` + `vector_store_ids` handles it — but confirm the fallback's response shape for citations (search metadata field name may differ).
2. Does Backstage's `HttpRouterService` default middleware (compression in particular) buffer SSE streams? If yes, add the chat route to a compression skip-list or use `res.flushHeaders()` aggressively. If that doesn't work, fall back to a raw Node http handler via `httpRouter.addAuthPolicy` + custom route.