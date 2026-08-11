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
yarn workspace @acstage/app add @acarmim/backstage-plugin-litellm-chat
yarn workspace @acstage/backend add @acarmim/backstage-plugin-litellm-chat-backend
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
```

## Features

- **Streaming UI**: Real-time token streaming for a modern chat experience, with regenerate/edit-and-resend, message and code-block copy, and a streaming-state indicator ring on the persona avatar.
- **RAG Support**: Seamlessly switch between plain chat and grounded retrieval using LiteLLm vector stores, plus an optional web search source and an ad-hoc `#https://...` page-context command.
- **Governance Integratied**: Inherits all user authentication, budget, and rate limiting from the existing LiteLLM Governance plugin.
- **Per-user Keys**: Allow users to select their own LiteLLM keys for spend attribution.
- **Threads**: Search, pin, export/import as portable JSON.
- **Compare mode**: Send the same prompt to several models in parallel and compare replies side by side.
- **LaTeX rendering** in assistant messages.
- **Analytics**: A lightweight `/ai-chat/analytics` page for usage-by-persona/model and feedback totals.
