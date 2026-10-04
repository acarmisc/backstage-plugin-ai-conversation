# @acarmisc/backstage-plugin-ai-conversation

Frontend of [AI Conversation for Backstage](https://github.com/acarmisc/backstage-plugin-ai-conversation):
a chat page on top of a LiteLLM gateway, with team-bound keys, knowledge
bases, skills, compare mode and conversation history.

![The chat page](https://raw.githubusercontent.com/acarmisc/backstage-plugin-ai-conversation/main/docs/images/chat.png)

## Install

Requires the backend package `@acarmisc/backstage-plugin-ai-conversation-backend`
and the [LiteLLM Governance plugin](https://github.com/acarmisc/backstage-plugin-litellm-govai)
frontend (`@acarmisc/backstage-plugin-litellm`), whose API provides teams and
models.

```bash
yarn --cwd packages/app add @acarmisc/backstage-plugin-ai-conversation
```

For the new frontend system, add the plugin to your app (or let feature
discovery pick up the default export):

```ts
import aiConversationPlugin from '@acarmisc/backstage-plugin-ai-conversation';

const app = createApp({ features: [aiConversationPlugin] });
```

## Extensions

| Extension | Path |
| --- | --- |
| Chat page | `/ai-conversation` |
| Analytics page | `/ai-conversation/analytics` |
| `aiConversationApiRef` | API client for the backend routes |

`ChatPage`, `AnalyticsPage` and `AiConversationApi` are also exported for
apps that wire pages themselves.

The page loads the JetBrains Mono font and the KaTeX stylesheet from
`fonts.googleapis.com` and `cdn.jsdelivr.net`; allow them in your Content
Security Policy.

## Documentation

[User guide](https://github.com/acarmisc/backstage-plugin-ai-conversation/blob/main/docs/user-guide.md) ·
[Configuration](https://github.com/acarmisc/backstage-plugin-ai-conversation/blob/main/docs/configuration.md) ·
[Troubleshooting](https://github.com/acarmisc/backstage-plugin-ai-conversation/blob/main/docs/troubleshooting.md)
