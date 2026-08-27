# Rebrand follow-up — litellm-chat → ai-conversation

**Status: done.** This repo's rename (`3cfeacba4`) is fully rolled out — new
npm packages published, old ones deprecated, target Backstage app updated and
deployed. Kept below for reference; nothing here is still outstanding.

## 1. Publish the renamed npm packages — done

`@acarmisc/backstage-plugin-ai-conversation@0.10.0` and
`@acarmisc/backstage-plugin-ai-conversation-backend@0.10.0` published via
`ai-conversation@0.10.0` / `ai-conversation-backend@0.10.0` tags (this bump also
carried the attachment-picker/`ChatSettingsPanel` work, not just the rename).
The old `@acarmisc/backstage-plugin-litellm-chat(-backend)` packages (17/18
published versions) are deprecated on npm pointing at the new names.

## 2. Update the live Backstage deployment — done

`backstage-abstract-ces` (`gitlab.az.abssrv.it:innovation/playground/backstage-abstract-ces`,
commit `0002c3b`) now depends on the new package names, imports
`aiConversationPlugin`, registers the `ai-conversation-backend` module, and
its sidebar/quicklinks/nav-takes point at `/ai-conversation` and
`page:ai-conversation(/analytics)`. Deployed to production via GitLab CI
pipeline 155599 (`deploy:production` succeeded).

Not touched, deliberately: the `litellm-chat` catalog `System` entity in that
repo's `catalog-info.yaml` is referenced by the separate `ces-ai-personas`
repo and needs cross-repo coordination to rename — out of scope for this
plugin repo's rebrand.

## 3. Verify end-to-end after deploy — done

- `GET /api/ai-conversation/health` → `401` (auth enforced, route resolves —
  matches `HANDOFF.md`'s original "Auth enforced" check).
- `GET /ai-conversation` → `200` (SPA shell serves under the new route).
- `litellm.aiConversation.persistence.enabled` is not currently set in the
  live app-config (nothing to migrate); the `chat_threads` table and its
  gating logic are otherwise unaffected by the rename.
- Full interactive browser test (login, send a message, confirm
  streaming/citations/attachments) not done in this pass — no browser
  session available here. See `HANDOFF.md`'s "Not yet verified" list.

## Not touched, and why

- **DB migration filenames / table names** (`chat_threads`, `chat_events`,
  etc.) — renaming an already-applied Knex migration breaks migration-state
  tracking on any environment that's run it. Left as-is on purpose.
- **`litellm.baseUrl` / `litellm.masterKey` / `litellm.userIdDomain`** — these
  belong to the govai plugin's shared config surface, not this plugin's own
  branding. Only `litellm.chat.*` (this plugin's own optional subtree) moved
  to `litellm.aiConversation.*` — and that subtree isn't even set in the live
  app-config today, so there was nothing to migrate there either.
