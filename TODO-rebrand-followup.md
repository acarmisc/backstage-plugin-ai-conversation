# Rebrand follow-up — litellm-chat → ai-conversation

This repo's rename is committed (`3cfeacba4`). What's still outstanding, in the
order it'll bite you.

## 1. Publish the renamed npm packages

Nothing has been published under the new names yet. The old packages
(`@acarmisc/backstage-plugin-litellm-chat` v0.9.1, `-backend` v0.8.1, plus 16/17
older versions each) are still live on npm and untouched.

- Tag and push to trigger `.github/workflows/publish.yml` (now watches
  `ai-conversation@*` / `ai-conversation-backend@*` tags):
  ```
  git tag ai-conversation@0.9.1
  git tag ai-conversation-backend@0.8.1
  git push origin ai-conversation@0.9.1 ai-conversation-backend@0.8.1
  ```
  (Or bump versions first if you want the rename itself to be a visible release —
  your call, nothing about the rename requires a version bump.)
- Once the new names are live and you've verified consumers can pull them,
  consider `npm deprecate @acarmisc/backstage-plugin-litellm-chat "renamed to
  @acarmisc/backstage-plugin-ai-conversation"` (and `-backend`) so anyone still
  depending on the old name gets a clear pointer instead of silent staleness.

## 2. Update the live Backstage deployment

The instance at `backstage.ces.abstractstaging.it` (a *different* repo — the
Backstage host app) still references the old package names, `litellmChatPlugin`
export, and `/ai-chat` route. It will break on next deploy/dependency bump
until updated. Per `HANDOFF.md`'s "Files changed in target Backstage" table,
touch:

| File | Change needed |
|---|---|
| `packages/app/package.json` | `@acarmisc/backstage-plugin-litellm-chat` → `@acarmisc/backstage-plugin-ai-conversation` |
| `packages/app/src/App.tsx` | `litellmChatPlugin` import/usage → `aiConversationPlugin` |
| `packages/backend/package.json` | `@acarmisc/backstage-plugin-litellm-chat-backend` → `@acarmisc/backstage-plugin-ai-conversation-backend` |
| `packages/backend/src/index.ts` | `backend.add(import('@acarmisc/backstage-plugin-litellm-chat-backend'))` → `-ai-conversation-backend` |
| `app-config.yaml` | `litellm.chat.*` → `litellm.aiConversation.*` (the `litellm.baseUrl`/`masterKey`/`userIdDomain` keys are unchanged — shared with govai) |
| any sidebar nav / bookmarks | `/ai-chat` → `/ai-conversation` |

Do steps 1 and 2 together — bumping the host app's dependency to the new
package name is what actually needs the npm publish to have landed first.

## 3. Verify end-to-end after deploy

- `GET /api/ai-conversation/health` → `{"status":"ok"}`
- Browser: log in, load `/ai-conversation`, confirm streaming + citations still
  work (same check `HANDOFF.md` used for the original ship).
- If `litellm.aiConversation.persistence.enabled` is set in the live config,
  confirm existing persisted threads still load — the DB table itself
  (`chat_threads`) and its schema are untouched, only the config key that
  gates the feature moved.

## Not touched, and why

- **DB migration filenames / table names** (`chat_threads`, `chat_events`,
  etc.) — renaming an already-applied Knex migration breaks migration-state
  tracking on any environment that's run it. Left as-is on purpose.
- **`litellm.baseUrl` / `litellm.masterKey` / `litellm.userIdDomain`** — these
  belong to the govai plugin's shared config surface, not this plugin's own
  branding. Only `litellm.chat.*` (this plugin's own optional subtree) moved
  to `litellm.aiConversation.*`.
