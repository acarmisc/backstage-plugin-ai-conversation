# Contributing

Thanks for helping. This repository follows the conventions of the
[Backstage](https://github.com/backstage/backstage/blob/master/CONTRIBUTING.md)
and [community plugins](https://github.com/backstage/community-plugins/blob/main/CONTRIBUTING.md)
projects where they apply to a standalone plugin repository. The differences
are listed below.

By contributing you agree to the [Code of Conduct](CODE_OF_CONDUCT.md) and
license your work under [Apache-2.0](LICENSE). Report security issues as
described in [SECURITY.md](SECURITY.md), not in public issues.

## Layout

```
packages/
  plugin-ai-conversation/                    frontend
  plugin-ai-conversation-backend/            backend plugin
```

## Setup

Node.js 22 or 24, with Yarn 4 (managed via Corepack).

```bash
corepack enable
yarn install
```

## Checks

Run these before opening a pull request. CI runs the same, plus
`node scripts/check-packages.mjs` on the packed tarballs.

```bash
yarn build           # frontend and backend bundles
yarn lint
yarn test
```

Tests use Jest; test files sit next to the code as `*.test.ts(x)`.

To work on the frontend without a Backstage app, start the dev harness. It
serves the chat page on deterministic mock data (teams, models, knowledge
bases, skills, threads and a fake streaming reply) at
http://localhost:3000/ai-conversation:

```bash
cd packages/plugin-ai-conversation && yarn start
```

With the harness running, `node scripts/capture-screenshots.mjs` regenerates
the screenshots in `docs/images`.

To try a change in a real app, build, then point the app's `package.json` at
the package with a `file:` dependency and reinstall. The app copies the
package, so reinstall after every rebuild.

## Code conventions

- [New frontend system](https://backstage.io/docs/frontend-system/) and
  [new backend system](https://backstage.io/docs/backend-system/) only.
- Match the surrounding code; existing components use `React.FC` with typed
  props.
- Comments explain why, not what. Don't add comments that repeat the code.
- Catalog annotations and entity values are authored by catalog/repository admins:
  treat them as potentially untrusted in the backend.
- New backend routes go in `packages/plugin-ai-conversation-backend/src/router.ts`.
- Skill system prompts are resolved server-side; they never reach the browser
  and cannot be edited via client-side tampering.

## Commits and pull requests

- Sign off every commit
  ([DCO](https://github.com/backstage/backstage/blob/master/CONTRIBUTING.md#developer-certificate-of-origin)):
  `git commit -s`.
- Keep commits coherent and the diff limited to the change.
- Add an entry under a new version heading in the `CHANGELOG.md` of each
  package you change, written for the people who install the package: what
  changed for them, not which functions moved. Mark breaking changes with
  **BREAKING** and say what to do.
- Update the README of the package when its installation, configuration or
  behaviour changes.
- Include screenshots for UI changes.

### Using AI tools

The
[Backstage AI use policy](https://github.com/backstage/backstage/blob/master/CONTRIBUTING.md#ai-use-policy-and-guidelines)
applies: you must understand and have tested every change you submit, and be
able to explain it. Say in the pull request when a change is largely
AI-generated. Keep descriptions short and about why the change is needed.

## Releasing

Maintainers release from `main`; the publish workflow is the only way packages
reach npm.

1. Bump `version` in the package's `package.json` and date its changelog entry.
2. Merge to `main`.
3. Push a tag `<prefix>@<version>`, or run the **Publish to npm** workflow on
   `main` with the tag as input:

| Tag prefix              | Package                                               |
| ----------------------- | ----------------------------------------------------- |
| `ai-conversation`       | `@acarmisc/backstage-plugin-ai-conversation`          |
| `ai-conversation-backend` | `@acarmisc/backstage-plugin-ai-conversation-backend`  |

The workflow fails if the tag version differs from `package.json`, builds every
workspace, checks the tarball, publishes and creates the GitHub release.
