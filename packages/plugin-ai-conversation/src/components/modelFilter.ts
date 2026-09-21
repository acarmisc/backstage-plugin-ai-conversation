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
