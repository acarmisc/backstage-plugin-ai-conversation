"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entityToPersonaSummary = entityToPersonaSummary;
exports.resolveSystemPrompt = resolveSystemPrompt;
const types_1 = require("./types");
function annotation(entity, key) {
    return entity.metadata.annotations?.[`${types_1.CHAT_PERSONA_ANNOTATION_PREFIX}/${key}`];
}
function entityRef(entity) {
    const ns = entity.metadata.namespace ?? 'default';
    return `${entity.kind.toLowerCase()}:${ns}/${entity.metadata.name}`;
}
function splitCsv(raw) {
    if (!raw)
        return undefined;
    const parts = raw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    return parts.length ? parts : undefined;
}
/** Map a catalog entity to the metadata shown in the frontend picker. Does
 * not include the system prompt — see `resolveSystemPrompt`. */
function entityToPersonaSummary(entity) {
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
function resolveSystemPrompt(entity) {
    return annotation(entity, 'system-prompt');
}
