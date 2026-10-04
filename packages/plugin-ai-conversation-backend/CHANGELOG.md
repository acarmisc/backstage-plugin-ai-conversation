# Changelog

## Unreleased

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
