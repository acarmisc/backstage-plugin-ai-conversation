import { Entity } from '@backstage/catalog-model';
import { CHAT_PERSONA_ANNOTATION_PREFIX, PersonaSummary } from './types';

function annotation(entity: Entity, key: string): string | undefined {
  return entity.metadata.annotations?.[`${CHAT_PERSONA_ANNOTATION_PREFIX}/${key}`];
}

function entityRef(entity: Entity): string {
  const ns = entity.metadata.namespace ?? 'default';
  return `${entity.kind.toLowerCase()}:${ns}/${entity.metadata.name}`;
}

function splitCsv(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

/** Map a catalog entity to the metadata shown in the frontend picker. Does
 * not include the system prompt — see `resolveSystemPrompt`. */
export function entityToPersonaSummary(entity: Entity): PersonaSummary {
  return {
    id: entityRef(entity),
    title: entity.metadata.title ?? entity.metadata.name,
    description: entity.metadata.description,
    defaultModel: annotation(entity, 'default-model'),
    defaultVectorStoreIds: splitCsv(annotation(entity, 'default-vector-stores')),
    tags: entity.metadata.tags,
  };
}

/** Extract the system prompt annotation. Returns undefined if missing. */
export function resolveSystemPrompt(entity: Entity): string | undefined {
  return annotation(entity, 'system-prompt');
}
