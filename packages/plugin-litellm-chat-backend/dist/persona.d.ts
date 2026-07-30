import { Entity } from '@backstage/catalog-model';
import { UrlReaderService } from '@backstage/backend-plugin-api';
import { ScmIntegrationRegistry } from '@backstage/integration';
import { PersonaSummary } from './types';
export interface PersonaPromptDeps {
    reader: UrlReaderService;
    scm: ScmIntegrationRegistry;
}
/** Map a catalog entity to the metadata shown in the frontend picker. Does
 * not include the system prompt — see `resolveSystemPrompt`. */
export declare function entityToPersonaSummary(entity: Entity): PersonaSummary;
/**
 * Resolve a persona entity to its system prompt string.
 *
 * A `system-prompt-ref` annotation points at a Markdown file (relative to
 * the entity's `catalog-info.yaml` source location). It is fetched, its
 * frontmatter stripped, and its `{{include: <path>}}` directives expanded
 * recursively into one composed prompt — the ref takes precedence when set.
 * A legacy inline `system-prompt` annotation remains a fallback for trivial
 * one-liners. Returns undefined when neither is present.
 */
export declare function resolveSystemPrompt(entity: Entity, deps: PersonaPromptDeps): Promise<string | undefined>;
