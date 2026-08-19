# LiteLLM RAG Chat Plugin

This repository contains the Backstage plugins for LiteLLM RAG capabilities.

## Packages

### [@acarmisc/backstage-plugin-litellm-chat](packages/plugin-litellm-chat)
The frontend plugin that provides a streaming chat interface, including model selection, vector store (knowledge base) selection, and API key management.

### [@acarmisc/backstage-plugin-litellm-chat-backend](packages/plugin-litellm-chat-backend)
The backend plugin that acts as a streaming proxy to the LiteLLM proxy, handling RAG queries and vector store retrieval.

## Installation

To use these plugins in your Backstage instance, add them to your `packages/app/package.json` and `packages/backend/package.json` respectively.

```bash
yarn workspace app add @acarmisc/backstage-plugin-litellm-chat
yarn workspace backend add @acarmisc/backstage-plugin-litellm-chat-backend
```

## Usage

### Configuration

Add the following to your `app-config.yaml`:

```yaml
litellm:
  baseUrl: http://your-litellm-proxy:4000
  masterKey: ${LITELLM_MASTER_KEY}
  chat:
    defaultModel: claude-3-5-sonnet
    persistence:
      enabled: false   # opt-in: persist chat threads server-side instead of browser-only
      ttlDays: 30       # auto-delete threads after N days of inactivity; 0 = keep forever
```

## Features

- **Streaming UI**: Real-time token streaming for a modern chat experience, with regenerate/edit-and-resend, message and code-block copy, and a streaming-state indicator ring on the persona avatar.
- **RAG Support**: Seamlessly switch between plain chat and grounded retrieval using LiteLLm vector stores, plus an optional web search source and an ad-hoc `#https://...` page-context command.
- **Personas**: Self-service, catalog-backed assistant profiles (`chat-persona` entities) bundling a system prompt with default model/knowledge-base — authored by any team via a `catalog-info.yaml`, no redeploy required. See `AGENTS.md` for the full persona authoring format.
- **Conversation customization**: Independent Tone, Focus, and Verbosity pickers layer short prompt fragments on top of the persona/custom prompt, plus a Reasoning effort picker (`low`/`medium`/`high`) forwarded natively to models that support it — mix and match without needing a dedicated persona per combination.
- **Governance Integrated**: Inherits all user authentication, budget, and rate limiting from the existing LiteLLM Governance plugin.
- **Per-user Keys**: Allow users to select their own LiteLLM keys for spend attribution.
- **Threads**: Search, pin, export/import as portable JSON. Client-side by default (localStorage); optionally persisted server-side via `litellm.chat.persistence.enabled`, with a configurable retention period (`ttlDays`, default 30, `0` = unlimited) enforced by a background cleanup job.
- **Compare mode**: Send the same prompt to several models in parallel and compare replies side by side.
- **LaTeX rendering** in assistant messages.
- **Analytics**: A lightweight `/ai-chat/analytics` page for usage-by-persona/model and feedback totals.
