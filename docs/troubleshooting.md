# Troubleshooting

## "A team is required, but you don't belong to any team yet"

The team picker lists the caller's LiteLLM teams, read through the governance
plugin. Add the user to a team in LiteLLM (or through the governance plugin's
team management), or set `litellm.aiConversation.teamRequired: false` to allow
keys without a team.

If the user is in a team but the backend log says *"that user has no teams in
LiteLLM — is litellm.provisioning.enabled set?"*, the LiteLLM user id the
backend computes doesn't match the one in LiteLLM: check `litellm.userIdDomain`
and the governance plugin's provisioning settings.

## "Access denied: team is not one of your teams" (403)

The conversation was bound to a team the user has since left. Pick another
team; a new key is minted.

## "Your chat key was rejected"

The conversation's key expired (after 3 hours) or was deleted in LiteLLM. The
page mints a new key and retries once on its own; send the message again if
the banner stays. If every attempt fails, check that `litellm.masterKey` is
the proxy's current master key and that the backend can reach
`litellm.baseUrl`.

## "Budget exhausted"

LiteLLM refused the call because the conversation key reached
`maxRequestBudget` or the team reached its budget. The Usage panel shows the
key's spend and budget. Ask the team admin to raise the team budget, or the
Backstage operator to raise `maxRequestBudget`.

## A model is missing from the picker

The picker shows the models the selected team can call, minus
`excludedModels`. Check the team's model list in LiteLLM (an empty list or
`all-proxy-models` means every model).

## Answers ignore the knowledge base

- The Sources panel is empty: retrieval returned nothing or failed. A failure
  is logged by the backend as *"Knowledge-base retrieval failed; continuing
  without grounding"*, usually because the vector store isn't registered in
  LiteLLM's database or its provider isn't reachable from LiteLLM.
- The knowledge base isn't listed: `GET /api/ai-conversation/vector_stores`
  shows what LiteLLM returns.

## "model … is not known to accept image attachments"

The model isn't in `multimodalModels` (or, without it, its name doesn't
contain a known vision model family such as `claude`, `gpt-4`, `gpt-5`,
`gemini`, `-vl`, `vision`, `llava`, `pixtral` or `nova-pro`). Add it to
`litellm.aiConversation.multimodalModels`; once that list is set, only the
models in it accept images.

## Images disappear after a reload

By design: images are kept only while the page is open, so they don't fill
the browser's storage or the server-side thread. Attach them again to ask
about them in a later session.

## Web search does nothing

`web_search` is forwarded to LiteLLM as `web_search_options`. Models without
a web search tool ignore it.

## `#https://…` doesn't attach the page

The page must be public `https`. Private and internal addresses, oversized
responses and slow sites are refused; the chip shows the reason.

## Math looks wrong

Your Content Security Policy blocks `cdn.jsdelivr.net`, where the KaTeX
stylesheet comes from. Allow it in `backend.csp`.

## Conversations don't follow me to another browser

They are stored in the browser unless `persistence.enabled` is on. With it
off, `/threads` routes answer 404 by design. Use export and import to move a
conversation.

## Skills don't show up

- Catalog skills must be `Component` entities with `spec.type: chat-skill`,
  ingested by the catalog.
- With `system-prompt-ref`, the entity needs a `backstage.io/managed-by-location`
  and the host must be readable by the Backstage URL reader (integrations).
- Changes to prompts are cached for about five minutes.
