/**
 * Applies the operator's `litellm.aiConversation.excludedModels` list to the
 * models returned by LiteLLM. An entry is either an exact model name
 * (case-insensitive) or a prefix when it ends in `*`.
 *
 * This exists so deployments can hide models that are registered in LiteLLM
 * but unusable through Backstage — e.g. ones needing a credential only a
 * vendor CLI injects. That's deployment-specific, so it belongs in config
 * rather than hard-coded in the picker.
 */
export function isModelExcluded(model: string, patterns: string[] | null | undefined): boolean {
  if (!patterns?.length) return false;
  const name = model.toLowerCase();
  return patterns.some(raw => {
    const pattern = raw.trim().toLowerCase();
    if (!pattern) return false;
    if (pattern.endsWith('*')) return name.startsWith(pattern.slice(0, -1));
    return name === pattern;
  });
}

export function filterModels<T>(
  models: T[],
  getName: (m: T) => string,
  patterns: string[] | null | undefined,
): T[] {
  if (!patterns?.length) return models;
  return models.filter(m => !isModelExcluded(getName(m), patterns));
}

/**
 * LiteLLM sentinel: a team's `models` list is `["all-proxy-models"]` when the
 * team isn't restricted to specific models. A team's `models` entries can also
 * be access-group names (see `ModelInfo.access_groups`) rather than literal
 * model names — treating either as a literal allowlist matches nothing.
 *
 * Mirrors govai's own copy in its `KeyFormDialog.tsx` (which does not export
 * it) so the chat and governance surfaces scope a team's models identically.
 */
export const ALL_PROXY_MODELS = 'all-proxy-models';

/** Minimal shape `isModelAllowedByTeam` needs — accepted structurally so both
 *  this plugin's and govai's `ModelInfo` (and plain test fixtures) work. */
export interface TeamScopedModel {
  model_name: string;
  access_groups?: string[];
}

/**
 * Whether a team's `models` allowlist permits this model. An empty/absent
 * list means the team is unrestricted (every model is allowed).
 *
 * This is a *display* filter only — real enforcement is LiteLLM's, applied
 * when a key minted with `team_id` is used. Keeping the picker in sync with
 * that allowlist just stops users from selecting a model the proxy will
 * reject.
 */
export function isModelAllowedByTeam(
  model: TeamScopedModel,
  teamModels?: string[] | null,
): boolean {
  if (!teamModels?.length) return true;
  if (teamModels.includes(ALL_PROXY_MODELS)) return true;
  if (teamModels.includes(model.model_name)) return true;
  return !!model.access_groups?.some(group => teamModels.includes(group));
}

/** Applies a team's model allowlist to the model catalogue — see
 *  `isModelAllowedByTeam`. Undefined/null `teamModels` passes everything
 *  through (no team picked yet), matching govai's behaviour. */
export function filterModelsByTeam<T extends TeamScopedModel>(
  models: T[],
  teamModels?: string[] | null,
): T[] {
  if (!teamModels?.length) return models;
  return models.filter(m => isModelAllowedByTeam(m, teamModels));
}
