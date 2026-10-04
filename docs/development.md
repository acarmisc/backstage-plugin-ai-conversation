# Development

Yarn 4 workspaces (enable it with `corepack enable`), Node 22 or 24.

```bash
yarn install
yarn lint
yarn test     # Jest, both packages
yarn build    # esbuild bundles + type declarations
node scripts/check-packages.mjs   # what npm would receive
```

## Dev harness

The frontend package runs on its own, on mock data, without a backend or a
LiteLLM proxy:

```bash
cd packages/plugin-ai-conversation
yarn start    # http://localhost:3000/ai-conversation
```

`dev/mockFetch.ts` replaces the app's `fetchApi`, so the real API client and
the AI SDK streaming transport both run against it. It serves teams, models,
knowledge bases, skills, stored conversations, chat keys with spend, and a
streamed reply in the AI SDK UI message stream protocol (with citations when
a knowledge base is selected). `dev/mockApi.ts` stands in for the governance
plugin's API (teams and models).

## Screenshots

The images in `docs/images` come from the harness:

```bash
cd packages/plugin-ai-conversation && yarn start      # terminal 1
npm install --no-save playwright                      # once, anywhere
node scripts/capture-screenshots.mjs                  # terminal 2
```

`BASE_URL` overrides the harness address and `CHROMIUM_PATH` the browser.

## Layout

| Path | Contents |
| --- | --- |
| `packages/plugin-ai-conversation/src/components` | Page, sidebar, header, composer, messages, context panel, pickers |
| `packages/plugin-ai-conversation/src/hooks` | `useThreads` (state and streaming), persistence, compare, shortcuts, scrolling |
| `packages/plugin-ai-conversation/src/utils` | Date grouping, Markdown export, citations, starter prompts |
| `packages/plugin-ai-conversation-backend/src` | Routes, validation, streaming, retrieval, skills, persistence |
| `packages/plugin-ai-conversation-backend/migrations` | Knex migrations, run by the plugin on startup |
| `packages/plugin-ai-conversation-backend/skills` | Bundled skills |

Contributing rules and the release process are in
[CONTRIBUTING.md](../CONTRIBUTING.md).
