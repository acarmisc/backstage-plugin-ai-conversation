# Handoff — AI SDK Migration, UI Tidy-up, Codebase Cleanup

## Why this exists

The chat experience today works but feels "weird and complex," and is missing table-stakes
features (attachments, and the feedback/UX polish around it) that every hand-rolled increment
made incrementally harder to add. This isn't one bug — it's the accumulated cost of `useChat.ts`
(`packages/plugin-ai-conversation/src/hooks/useChat.ts`, ~800 lines) and `api.ts`'s manual SSE
reader (`normalizeChunk`, `chatStream`) having grown, phase by phase (see `todo.txt` phase3,
phase6, phase10, phase13), into a bespoke state machine that now owns: thread state, streaming,
abort-per-message maps, compare-mode fan-out, regenerate/edit-resend truncation, and localStorage
+ optional server sync — all hand-written, with at least one known-open correctness gap
(`todo.txt` phase10-message-actions: *"Abort in-flight generation before regenerate or
edit-resend"*, never resolved).

This plan replaces that hand-rolled core with the [Vercel AI SDK](https://ai-sdk.dev)
(`ai` + `@ai-sdk/react`) as the streaming/state engine, keeps MUI for every pixel rendered (no
Tailwind/shadcn — see "Design decisions" below for why that's no longer a blocker), adds
attachments as a first-class feature, and uses the rewrite as the forcing function to decompose
`ChatPage.tsx` (currently 880 lines, one component owning sidebar + settings + composer +
messages) and clear out the dead-dependency backlog already logged in `HANDOFF.md`.

**Three workstreams, in dependency order:**

1. Adopt AI SDK as the state/streaming engine (backend protocol + frontend hooks).
2. Add attachments, and make tool-calls a first-class renderable part (MCP-ready, not
   MCP-wired — see "Non-goals").
3. Tidy the UI (decompose `ChatPage.tsx`) and clean up the codebase (dead deps, stale docs,
   superseded hand-rolled code).

**Non-goals** (explicitly out of scope for this initiative):

- Wiring an actual MCP server through the chat UI. This plan makes tool-call parts renderable
  so that work is a follow-on, not a prerequisite — see "Future: MCP readiness" below.
- Changing the backend's identity/governance model. `resolveUserId` → `toLiteLLMUserId` →
  per-thread key minting via the govai plugin stays exactly as it is (`router.ts` `/chat/key`).
- Changing the persona/trait system prompt composition (`persona.ts`, `traits.ts`,
  `composeSystemPrompt`). Server-side prompt resolution is a locked decision (AGENTS.md) and
  nothing here touches it.
- Server-side RAG/vector-store logic. LiteLLM still owns retrieval; this plan only changes how
  the browser and the Express proxy talk to each other and to LiteLLM's streaming endpoint.

---

## Current architecture (what's being replaced)

```
ChatPage.tsx (880 lines)
  └─ useChat() hook (800 lines)
       ├─ Thread[] in React state, mirrored to localStorage (debounced)
       ├─ optional server sync (persistence.ts, opt-in via config)
       ├─ Map<messageId, AbortController>  — one entry per in-flight stream
       ├─ runSend / runCompareSend — hand-built truncate-and-resend for
       │  regenerate/edit, hand-built parallel fan-out for compare mode
       └─ calls api.ts → AiConversationApi.chatStream()
            └─ manual fetch + ReadableStream reader + manual `data:` line
               parser + normalizeChunk() (OpenAI-shape → flat ChatStreamChunk)

Backend: router.ts POST /chat/stream → stream.ts proxySSE()
  → raw byte-for-byte passthrough of LiteLLM's OpenAI-shaped SSE stream
```

Everything downstream of "LiteLLM emits an OpenAI-shaped SSE stream" is custom code we wrote and
now maintain: the parser, the chunk-normalization, the thread reducer, the abort bookkeeping, the
regenerate/edit truncation logic (`hooks/chatTruncation.ts`), the compare-mode fan-out. None of
that is RAG-specific or LiteLLM-specific — it's exactly the problem class `ai`/`@ai-sdk/react`
exists to solve, and it's already tested against far more edge cases (reconnect, partial JSON,
multi-part messages, tool calls) than our bespoke version has been.

## Target architecture

```
ChatPage.tsx (thin shell)
  ├─ Sidebar (thread list, settings) — own component
  ├─ Composer — own component, now handles text + file attachments
  └─ MessageList — renders UIMessage[] parts (text/file/tool-call/tool-result/
     data-citations/data-usage), one renderer per part type

  useChat() from @ai-sdk/react, one instance per active thread
  (compare mode = N concurrent useChat instances, one per model — see below)
    └─ custom Transport → POST /api/ai-conversation/chat/stream
         (same route, new response protocol)

Backend: router.ts POST /chat/stream → stream.ts
  → adapter that converts LiteLLM's OpenAI-shaped SSE into the AI SDK's
    UI Message Stream Protocol (text-delta / tool-call / tool-result / finish
    parts), with citations and usage carried as custom `data-*` parts
```

Key shift: the backend proxy stops being a raw byte passthrough and becomes a real protocol
adapter. That's the one non-trivial new piece of backend code in this plan — everything else is
either configuration (provider setup) or deletion (removing hand-rolled frontend state code).

---

## Design decisions (locked for this migration)

Mirroring the table format in `AGENTS.md` — add these rows there once this lands.

| Decision | Choice | Rationale |
|---|---|---|
| State/streaming engine | `ai` (core) + `@ai-sdk/react` (`useChat`) | Replaces `hooks/useChat.ts`, `hooks/chatTruncation.ts`, and the manual SSE reader in `api.ts`. Gets abort/retry/regenerate semantics, a typed message-parts model, and attachment support for free instead of hand-rolled. |
| UI library | **Not** assistant-ui, **not** shadcn/Tailwind. Keep MUI. | The earlier assistant-ui evaluation (`HANDOFF.md` "UI library" decision) rejected it for clashing with Backstage's MUI theme — that's true of its prebuilt shadcn theme, not its headless primitives, but we don't need assistant-ui's component layer at all: adopting `@ai-sdk/react`'s hooks (headless, no bundled CSS) gets the state-engine win without pulling in a second component system. All rendering stays hand-written MUI, same as today. |
| Backend protocol | Convert `stream.ts`'s raw passthrough into an adapter emitting the **AI SDK UI Message Stream Protocol** | Considered a "custom Transport that just re-parses our existing flat-chunk shape" instead — rejected: it would mean re-inventing typed parts (tool calls, files) a second time on the client instead of getting them from the wire format the SDK already understands. Adapting server-side once is less total code than adapting client-side per feature. |
| LiteLLM provider adapter | An OpenAI-compatible provider (`@ai-sdk/openai-compatible` or equivalent) pointed at `chatConfig.baseUrl`, **used only for type/shape reference** — the actual upstream call still goes through our own `fetch` in `router.ts` (per-request `user_key` bearer, persona/trait system-prompt injection, `#url` context injection all stay server-side, unchanged) | We are not handing LiteLLM calls to the SDK's own provider/transport — the existing request-shaping logic in `router.ts` (`composeSystemPrompt`, `applyUrlContext`, `recordChatEvent`) is untouched. Only the *response* stream gets adapted to the SDK's wire protocol before reaching the browser. |
| Persisted message shape | Switch to the AI SDK's native `UIMessage`/parts shape as the thing we persist (both `localStorage` and `chat_threads.data`), **not** the current custom `Thread.messages: ChatMessage[]` | `ChatMessage` (flat `content: string` + ad-hoc `attachedUrl`/`compareModel`/`feedback` fields, `types.ts`) can't represent attachments or tool-call parts without more ad-hoc fields. One-time migration function maps old shape → `UIMessage[]` on load (see Phase E) so existing users don't lose history. |
| Compare mode | N concurrent `useChat` instances (one per selected model), coordinated by a thin `useCompareChat` wrapper that starts them together and merges their `status` for the shared "stop all" control | Preserves today's behavior (`runCompareSend`, side-by-side columns, `turnId` grouping) without fighting the SDK's per-chat instance model — each model column *is* one chat instance, which is a more natural fit than the current single global abort-map. |
| Attachments | Client attaches via the SDK's file-parts API; backend validates size/mime, forwards image parts to LiteLLM only for models the persona/model registry marks multimodal-capable, else rejects with a clear error before sending | Not a locked backend contract yet — the multimodal model list lives in the `litellm` repo's `models.yaml`, not this repo. Phase C spikes against whatever's registered live and documents the actual capability list found. |
| Feedback (thumbs up/down) | Stays exactly as-is (`POST /feedback`, `chat_message_feedback` table) — **not** part of the AI SDK migration | Feedback is app-specific business logic outside the SDK's scope (it doesn't model "vote on a message"). Only the *trigger point* moves from `AssistantMessage.tsx`'s current props to reading off the new `UIMessage` shape. |

---

## Feature-parity checklist

Every existing feature, what replaces its plumbing, and the risk level of that replacement.
Nothing here should silently regress — if a row can't be checked off by the end of the relevant
phase, it blocks release.

| Feature | Today (file) | After migration | Risk |
|---|---|---|---|
| Streaming chat | `api.ts` `chatStream` + `useChat.startStream` | `@ai-sdk/react` `useChat` + backend protocol adapter | Low — this is the primary SDK use case |
| Stop generation | `abortMapRef` per message id | SDK's built-in `stop()` per chat instance | Low |
| Regenerate | `chatTruncation.ts` `computeRegenerateTarget` + `runSend` | SDK's native regenerate (message-array truncation done via SDK's message-editing API) | Medium — verify SDK's regenerate semantics match "truncate through target, resend" exactly, esp. for compare mode |
| Edit & resend | `chatTruncation.ts` `computeEditTarget` | SDK's message-editing + resend | Medium — same verification as above |
| Compare mode (N models in parallel) | `runCompareSend`, shared `turnId`, `Map<msgId, AbortController>` | N `useChat` instances via `useCompareChat` wrapper (new) | Medium-high — this is the biggest behavioral rewrite; no direct SDK equivalent, needs the most new glue code |
| Threads (list/create/delete/select) | `useChat.ts` local state | New `useThreads` hook owning `UIMessage[]`-shaped threads, thin wrapper around existing localStorage/API calls | Low-medium — mostly a reshaping of existing `api.ts` calls (`listThreads`/`saveThread`/`deleteThread` stay) |
| Thread persistence (opt-in server-side) | `persistence.ts`, `chat_threads` table | Same table, same routes; `data` column now stores `UIMessage[]`-shaped payload instead of `ChatMessage[]` | Medium — needs a data-shape migration for existing rows (Phase E) |
| Export/import thread (portable JSON) | `useChat.exportThread`/`importThread` | Same feature, updated to export/import the new persisted shape; **add a v1→v2 import path** so old exports still load | Low-medium |
| Search/pin threads | `ChatPage.tsx` `threadMatchesQuery`/`sortThreads` | Unchanged — operates on thread metadata (title/pinned/updatedAt), not message shape | None |
| Personas | `persona.ts`, `PersonaPicker.tsx` | Unchanged — server-side prompt injection happens before the protocol adapter, untouched | None |
| Tone/Focus/Verbosity/Reasoning effort | `traits.ts`, `OptionPicker.tsx` | Unchanged | None |
| `#url` ad-hoc context | `urlContext.ts`, composer chip in `ChatPage.tsx` | Unchanged server-side; frontend chip logic moves into the new `Composer` component (Phase F) | Low |
| Web search toggle | `web_search` passthrough in `router.ts` | Unchanged | None |
| Citations / sources panel | `ChatStreamChunk.search_results` side-channel | Carried as a `data-citations` custom part in the new protocol; `SourcesPanel.tsx` reads it off the message instead of a separate `citations` state slot | Low — arguably *more* correct, since citations become per-message instead of one shared slot (fixes the known gap noted in AGENTS.md: *"Compare mode shares one citations/lastTurnUsage slot across all columns"*) |
| Usage/token counts | `ChatStreamChunk.usage` side-channel | `data-usage` custom part, same per-message improvement as citations | Low |
| Feedback (thumbs up/down) | `submitFeedback` in `useChat.ts` | Unchanged backend; frontend trigger reads the new message shape | Low |
| Analytics dashboard | `AnalyticsPage.tsx`, `chat_events` | Unchanged — logs at request-time in `router.ts`, independent of message shape | None |
| LaTeX rendering | `remark-math`/`rehype-katex` in markdown pipeline | Unchanged — still renders `part.text` content | None |
| Key picker / per-thread key minting | `KeyPicker.tsx`, `/chat/key` mint/delete | Unchanged | None |

---

## New capabilities added by this initiative

1. **Attachments** — file/image upload in the composer, sent as file parts, rendered as
   thumbnails/previews in both user and assistant messages. This directly reverses the
   `AGENTS.md` "Things NOT in v1" line *"File upload — Backstage chat is query-side only."*
   That line needs updating once this ships.
2. **Tool-call part rendering** ("MCP-ready") — `AssistantMessage.tsx` gains a renderer for
   `tool-*` parts (pending/result/error states), even though nothing calls a tool yet. This is
   scoped deliberately small: a renderer, not a tool-invocation feature. See "Future: MCP
   readiness."
3. **Per-message citations/usage** — a side effect of moving citations/usage into typed parts
   instead of a single shared side-channel; closes the compare-mode citation-sharing gap logged
   in `AGENTS.md`'s "Known gaps."

---

## UI tidy-up: `ChatPage.tsx` decomposition

`ChatPage.tsx` is 880 lines today, owning: sidebar rail, settings panel (persona/tone/focus/
model/compare/vector-store/web-search/verbosity/reasoning/key pickers), thread list + search +
pin + menu, composer + `#url` chip logic, message list container, right-rail sources/usage panel.
Every piece of local `useState` in that file (20+ hooks) is a candidate for being scoped down into
whichever child component actually owns it. Target decomposition:

```
ChatPage.tsx            — layout shell only (three-column flex), ~100 lines
├─ ChatSidebar.tsx       — collapsed rail + thread list + search + pin menu + import
├─ ChatSettingsPanel.tsx — persona/tone/focus/model/compare/KB/web-search/verbosity/
│                          reasoning/key pickers (currently inline in ChatPage's Collapse)
├─ ChatComposer.tsx      — input, #url chip logic + preview fetch, send/stop button,
│                          attachment button (new)
└─ (existing) MessageList.tsx, SourcesPanel.tsx, UsagePanel.tsx — unchanged placement,
   updated to read off UIMessage parts
```

State ownership moves with each piece — e.g. `sidebarCollapsed`/`searchQuery`/thread-menu state
moves into `ChatSidebar`, `showSettings`/all the picker values move into `ChatSettingsPanel`
(lifted only as far up as `ChatPage` needs to pass into `useChat`/`useCompareChat`). This is a
mechanical extraction, not a redesign — do it *after* the state-engine migration (Phase D/E) so
you're not refactoring component boundaries and the underlying data model in the same pass.

---

## Phased plan

Continues the repo's existing phase numbering (`todo.txt` currently ends at phase15). Each phase
is small and independently shippable/revertable. Suggested `todo.txt` entries are included at the
end of this doc, ready to append in the existing format.

### Phase 16 — Spike & verify (no product code shipped)

Goal: de-risk the two unknowns that could blow up the plan before touching `useChat.ts`.

- Add `ai` + `@ai-sdk/react` as dependencies in `packages/plugin-ai-conversation/package.json`;
  confirm `build.js` (esbuild-based, no bundler magic) can build against them and `tsc -p
  tsconfig.json` type-checks cleanly. This repo's build pipeline is hand-rolled (see the KaTeX
  CSS workaround in `theme.ts` — no CSS loader in the esbuild pipeline), so don't assume a
  standard Next.js/Vite AI SDK quickstart translates directly.
- Confirm React 18 compatibility of the current AI SDK major version (peer dep in this repo is
  pinned `react@^18.0.0` — verify the SDK doesn't require React 19).
- Spike the backend protocol adapter against a **non-production** route
  (`/chat/stream-v2` or similar, feature-flagged) converting one real LiteLLM SSE response
  (grab a captured example from the live `llm-gw` gateway) into the UI Message Stream Protocol,
  and confirm a minimal `@ai-sdk/react` `useChat` on a throwaway test page can consume it
  end-to-end (text streams, at minimum).
- Confirm whether an official OpenAI-compatible provider package cleanly types LiteLLM's
  response shape for reference, or whether the adapter needs to be hand-written from the
  protocol spec directly. Either is fine — this just decides how much of the adapter is
  "wire up a package" vs "write a transform function."

Exit criteria: a throwaway page in this repo streams real LiteLLM output through the new
protocol into a stock `useChat` render. Nothing user-facing changes yet.

### Phase 17 — Backend protocol adapter

- Replace `stream.ts`'s `proxySSE` raw passthrough with an adapter step that:
  - Parses LiteLLM's OpenAI-shaped `chat.completion.chunk` events (same shape `normalizeChunk`
    in `api.ts` parses today — that logic moves server-side).
  - Emits AI SDK UI Message Stream Protocol frames: text-delta parts for `delta.content`,
    finish part on `[DONE]`, error part on upstream error.
  - Emits `search_results` (citations) and `usage` as custom `data-citations`/`data-usage`
    parts instead of the current ad-hoc top-level fields.
- Keep `/chat/completions` (non-streaming) as-is for now — it's used by fewer call sites; decide
  in Phase D whether the frontend still needs it once `useChat` covers the streaming path.
- Unit-test the adapter directly (feed it captured LiteLLM SSE fixtures, assert protocol-correct
  output) — this is the one piece of new backend logic in the whole plan and the easiest to get
  subtly wrong (chunk boundaries, partial JSON, `[DONE]` handling all have existing hand-rolled
  edge-case handling in `api.ts` today that must not regress).

### Phase 18 — Attachments (backend)

- Add a file-upload endpoint (or extend `/chat/stream`'s request body to accept file parts
  inline, size-permitting — decide based on what the SDK's client-side attachment API expects
  to send).
- Validate mime/size server-side before forwarding to LiteLLM.
- Determine per-model multimodal support: cross-check against the `litellm` repo's
  `models.yaml` (different repo — `/Users/andrea/Projects/abstract-ces/playground/litellm`) for
  which registered models actually accept image input; reject attachment requests for
  non-multimodal models with a clear error rather than sending and letting LiteLLM 400.

### Phase 19 — Frontend state migration

- Introduce `useThreads` (new) — thin wrapper managing the list of threads (metadata: id,
  title, pinned, timestamps) and, per active thread, an `@ai-sdk/react` `useChat` instance
  configured with a custom `Transport` pointed at `/api/ai-conversation/chat/stream`, carrying the
  same request fields `useChat.ts` builds today (`model`, `vector_store_ids`, `persona_id`,
  `custom_system_prompt`, `tone_id`/`focus_id`/`verbosity_id`, `reasoning_effort`,
  `context_url`, `web_search`, `top_k`, `user_key`).
- Introduce `useCompareChat` (new) — coordinates N `useChat` instances per the "Compare mode"
  design decision above; owns the shared `turnId` grouping and a combined stop-all control.
- Delete `hooks/chatTruncation.ts` once regenerate/edit-resend are confirmed working through
  the SDK's own APIs (parity-checklist row above) — don't delete until that's verified, since
  it's the highest-risk row in the checklist.
- `api.ts`: delete `normalizeChunk` and the manual `chatStream` SSE reader (logic now lives
  server-side per Phase 17); keep the non-streaming REST methods (`listVectorStores`,
  `listPersonas`, `mintChatKey`, `sendFeedback`, thread CRUD, etc.) as-is.

### Phase 20 — Persisted-shape migration

- Update `hooks/threadPersistence.ts` (`toSaveThreadBody`/`fromPersisted`) to serialize/
  deserialize `UIMessage[]`-shaped threads instead of `ChatMessage[]`.
- Write a one-time migration function: on load, if a `localStorage` or `chat_threads.data`
  thread is in the old `ChatMessage[]` shape, map it to `UIMessage[]` (flat `content` → single
  text part; `attachedUrl`/`compareModel`/`feedback` fields map to their new equivalents or are
  dropped with a console warning if genuinely unrepresentable). Existing users must not lose
  history on first load post-upgrade.
- Bump `ThreadExport.version` (currently `1` in `types.ts`) to `2`; keep a v1-import path in
  `importThread` so old exported JSON files still load.
- Update the `chat_threads` migration story: either a data-shape version field in the JSON
  payload (preferred — no schema migration needed, `persistence.ts` already treats `data` as
  opaque) or a new Knex migration if a structural DB change turns out to be necessary. Prefer
  the former given `persistence.ts`'s existing "never interpreted server-side" design.

### Phase 21 — UI rendering rebuild

- `AssistantMessage.tsx`/`UserMessage.tsx`: switch from rendering a flat `content: string` to
  iterating `message.parts`, with a renderer per part type (text → existing markdown pipeline,
  file → thumbnail/preview, `tool-*` → new pending/result/error renderer, `data-citations`/
  `data-usage` → feed `SourcesPanel`/`UsagePanel` per-message instead of the current shared
  `citations`/`lastTurnUsage` state in `ChatPage.tsx`).
- `MessageList.tsx`: update `groupMessages` to work off the new message shape; compare-mode
  column grouping (`turnId`) logic is preserved, just reading a different message shape.
- Decompose `ChatPage.tsx` per the "UI tidy-up" section above — do this now, after the data
  model has settled, not before.
- Add the attachment button + preview UI to the new `ChatComposer.tsx`.

### Phase 22 — Cleanup

- Remove now-unused dependencies flagged in `HANDOFF.md`'s existing "Known issues" #7/#8:
  `@backstage/core-components` and `react-use` from the frontend package, `@backstage/types`
  from the backend package (confirm still unused post-migration before deleting).
- Delete superseded code: `hooks/chatTruncation.ts` (if fully replaced per Phase 19),
  `normalizeChunk`/manual SSE reader in `api.ts` (per Phase 19).
- Update stale docs:
  - `AGENTS.md`'s "Key design decisions (locked)" table — the "Chat key strategy" row still
    says *"User picks a key in the UI (dropdown from their existing keys)"*, but the actually
    shipped behavior (per `HANDOFF.md` decision #3) is auto-mint-per-thread. Fix this
    inaccuracy while editing the table for the new AI-SDK-related rows anyway.
  - `AGENTS.md` "Things NOT in v1" — remove the "File upload" line (superseded by Phase 18).
  - `AGENTS.md` "State management" section (currently describes `useChat.ts` directly) —
    rewrite to describe `useThreads`/`useCompareChat` + `@ai-sdk/react`.
  - `README.md` — no user-facing config changes expected, but re-verify the config example
    still matches `config.d.ts` after this lands.
- Re-run a review pass (this repo's own convention — see `review-1.md`, and `HANDOFF.md`'s
  *"No review-2 yet. Recommend another review pass after browser testing"*, which was never
  done even for the currently-shipped state). Given this migration touches the entire streaming
  core, this is the point to finally do that review — don't let it compound further.

### Phase 23 — Rollout

- Version bump: this is a breaking internal change (persisted shape, dependencies) but the
  *external* plugin API surface (config schema, routes) is largely unchanged — treat as a minor
  bump per this repo's semver-ish convention unless the `/chat/stream` request/response
  contract changes in a way that breaks a caller outside this repo (check: does anything besides
  this plugin's own frontend call `/chat/stream` directly? If not, minor bump is fine).
- Deploy behind the same staged-verification discipline `HANDOFF.md` used for the original
  ship: a "Verified on GKE" / "Not yet verified" checklist, browser-tested against the live
  `backstage.ces.abstractstaging.it/ai-conversation` instance before calling it done.
- Rollback plan: keep the old `useChat.ts`/`api.ts` code path available behind a temporary
  flag (or just don't delete it until Phase 23 verification passes — Phase 22's deletions can
  be the very last commit) so a bad rollout can revert by redeploying the prior version rather
  than needing a code revert under pressure.

---

## Future: MCP readiness

Not in scope here, but this plan is deliberately shaped to make it cheap later: once Phase 21
ships, `AssistantMessage.tsx` already renders `tool-*` parts. Wiring an actual MCP-backed tool
call (e.g., pointing at the `litellm` repo's `abstract_atlassian` MCP passthrough — see that
repo's `docs/mcp-atlassian.md`) becomes: forward `tools`/`tool_choice` through
`/v1/chat/completions` in `router.ts`, and the frontend renderer already exists to display the
result. That follow-on work is out of scope for this plan and should be its own phase (24+) once
scoped.

---

## Open risks to track

1. **Compare mode is the highest-risk rewrite** — no direct SDK equivalent for "N models, one
   shared turn, side-by-side columns." Budget real design time for `useCompareChat`, and
   prototype it early (Phase 19) rather than assuming it falls out naturally from N `useChat`
   instances.
2. **Regenerate/edit-resend semantics must be verified to match exactly**, not just
   approximately — today's `computeRegenerateTarget`/`computeEditTarget` have specific
   truncate-inclusive-vs-exclusive rules (see comments in `chatTruncation.ts` and `useChat.ts`)
   that a naive SDK-native regenerate might not replicate by default.
3. **Multimodal model coverage is unknown until Phase 18's spike** — depends on the live
   `litellm` gateway's registered models, which live in a different repo and can change
   independently of this one.
4. **Persisted-data migration is one-way once users' localStorage/DB rows get rewritten** — test
   the old→new mapping thoroughly against real exported thread JSON before shipping Phase 20,
   since a bad migration silently corrupts users' existing chat history.
5. **Backstage's esbuild-only build pipeline** (no CSS loader, no bundler-level polyfills) is
   the reason KaTeX CSS had to be loaded at runtime instead of bundled (`theme.ts`) — verify
   early (Phase 16) that the AI SDK packages don't assume a bundler feature this pipeline
   doesn't have.

---

## Appendix: `todo.txt` entries to append

Matches the existing `(A)/(B) date +tag task @context` format used through phase15.

```
(B) 2026-08-27 +phase16-ai-sdk-spike Add ai and @ai-sdk/react deps verify esbuild build.js and tsc compile @frontend
(B) 2026-08-27 +phase16-ai-sdk-spike Verify AI SDK major version React 18 peer-dep compatibility @research
(B) 2026-08-27 +phase16-ai-sdk-spike Spike feature-flagged chat-stream-v2 route emitting UI Message Stream Protocol @backend
(B) 2026-08-27 +phase16-ai-sdk-spike Verify throwaway useChat test page consumes spiked protocol end-to-end @research
(B) 2026-08-27 +phase17-protocol-adapter Move normalizeChunk parsing logic server-side into stream.ts adapter @backend
(B) 2026-08-27 +phase17-protocol-adapter Emit text-delta finish and error parts per UI Message Stream Protocol @backend
(B) 2026-08-27 +phase17-protocol-adapter Emit search_results as data-citations and usage as data-usage custom parts @backend
(B) 2026-08-27 +phase17-protocol-adapter Unit test adapter against captured LiteLLM SSE fixtures @backend
(B) 2026-08-27 +phase18-attachments Add file upload endpoint or inline file-part request handling @backend
(B) 2026-08-27 +phase18-attachments Validate mime and size server-side before forwarding to LiteLLM @backend
(B) 2026-08-27 +phase18-attachments Cross-check litellm repo models.yaml for multimodal-capable models @research
(B) 2026-08-27 +phase18-attachments Reject attachment requests for non-multimodal models with clear error @backend
(B) 2026-08-27 +phase19-state-migration Implement useThreads wrapping per-thread ai-sdk useChat with custom Transport @frontend
(B) 2026-08-27 +phase19-state-migration Implement useCompareChat coordinating N useChat instances per compare mode @frontend
(B) 2026-08-27 +phase19-state-migration Verify SDK regenerate matches computeRegenerateTarget truncate semantics @frontend
(B) 2026-08-27 +phase19-state-migration Verify SDK edit-resend matches computeEditTarget truncate semantics @frontend
(B) 2026-08-27 +phase19-state-migration Delete chatTruncation.ts once regenerate edit-resend parity verified @frontend
(B) 2026-08-27 +phase19-state-migration Delete normalizeChunk and manual SSE reader from api.ts @frontend
(B) 2026-08-27 +phase20-persisted-shape Update threadPersistence toSaveThreadBody fromPersisted for UIMessage shape @frontend
(B) 2026-08-27 +phase20-persisted-shape Write one-time migration mapping old ChatMessage threads to UIMessage @frontend
(B) 2026-08-27 +phase20-persisted-shape Bump ThreadExport version to 2 keep v1 import path @frontend
(B) 2026-08-27 +phase20-persisted-shape Decide data-shape version field vs new Knex migration for chat_threads @backend
(B) 2026-08-27 +phase21-ui-rebuild Rewrite AssistantMessage UserMessage to render message parts array @frontend
(B) 2026-08-27 +phase21-ui-rebuild Add tool-call part renderer pending result error states @frontend
(B) 2026-08-27 +phase21-ui-rebuild Add file part thumbnail preview renderer @frontend
(B) 2026-08-27 +phase21-ui-rebuild Update MessageList groupMessages for new message shape @frontend
(B) 2026-08-27 +phase21-ui-rebuild Extract ChatSidebar component from ChatPage @frontend
(B) 2026-08-27 +phase21-ui-rebuild Extract ChatSettingsPanel component from ChatPage @frontend
(B) 2026-08-27 +phase21-ui-rebuild Extract ChatComposer component with attachment button from ChatPage @frontend
(B) 2026-08-27 +phase22-cleanup Remove unused core-components and react-use deps from frontend package @frontend
(B) 2026-08-27 +phase22-cleanup Remove unused backstage types dep from backend package @backend
(B) 2026-08-27 +phase22-cleanup Fix stale chat key strategy row in AGENTS.md locked decisions table @docs
(B) 2026-08-27 +phase22-cleanup Remove file upload not-in-v1 line from AGENTS.md @docs
(B) 2026-08-27 +phase22-cleanup Rewrite AGENTS.md state management section for useThreads useCompareChat @docs
(B) 2026-08-27 +phase22-cleanup Run review-2 pass over the full migration @integration
(B) 2026-08-27 +phase23-rollout Decide semver bump given persisted-shape and dependency changes @release
(B) 2026-08-27 +phase23-rollout Browser-verify against live backstage.ces.abstractstaging.it/ai-conversation @integration
(B) 2026-08-27 +phase23-rollout Keep old useChat api.ts path available until verification passes @release
```
