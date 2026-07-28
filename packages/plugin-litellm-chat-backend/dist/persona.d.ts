import { Entity } from '@backstage/catalog-model';
import { PersonaSummary } from './types';
/** Map a catalog entity to the metadata shown in the frontend picker. Does
 * not include the system prompt — see `resolveSystemPrompt`. */
export declare function entityToPersonaSummary(entity: Entity): PersonaSummary;
/** Extract the system prompt annotation. Returns undefined if missing. */
export declare function resolveSystemPrompt(entity: Entity): string | undefined;
