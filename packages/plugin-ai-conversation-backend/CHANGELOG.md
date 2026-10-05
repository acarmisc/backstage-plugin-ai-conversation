# Changelog

## 0.20.1 — 2026-10-05

### Fixed

- Images were refused for models whose LiteLLM name has a provider or region
  prefix (`openai/gpt-4o`, `bedrock/eu.anthropic.claude-…`,
  `vertex_ai/gemini-…`) with "model … is not known to accept image
  attachments". The name check now matches anywhere in the name and also
  recognises Llama 3.2 Vision / Llama 4, Gemma 3, LLaVA, Pixtral, Qwen-VL and
  Amazon Nova Lite/Pro/Premier. `multimodalModels` still overrides it.

## 0.20.0 — 2026-10-05

No functional changes. Released to keep the version aligned with
`@acarmisc/backstage-plugin-ai-conversation@0.20.0`; 0.19.0 and 0.20.0 of the
two packages work together in any combination.

## 0.19.0 — 2026-10-05

### Security

- `DELETE /chat/key` only deletes chat keys that belong to the caller.
  Before, any signed-in user could delete any LiteLLM key whose value they
  knew.
- `litellm.aiConversation.maxRequestBudget` is enforced when minting keys,
  whatever budget the browser asks for.
- Error messages sent to the browser have keys and bearer tokens redacted.

### Changed

- `POST /chat/stream/v2` validates its body (model, messages, key,
  knowledge bases, `top_k`, `reasoning_effort`) and answers 400 with the
  reason; `GET /chat/key/:alias/spend` validates the alias.
- A failure to list the caller's keys while deleting one answers 502
  instead of 404.

## Earlier versions

See the [commit history](https://github.com/acarmisc/backstage-plugin-ai-conversation/commits/main).
