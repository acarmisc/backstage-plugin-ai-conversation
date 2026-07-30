import { Entity } from '@backstage/catalog-model';
import { UrlReaderService } from '@backstage/backend-plugin-api';
import { ScmIntegrationRegistry } from '@backstage/integration';
import { CHAT_PERSONA_ANNOTATION_PREFIX, PersonaSummary } from './types';

/** Catalog annotation Backstage stamps with the entity's source location,
 * e.g. `url:https://github.com/org/repo/blob/main/catalog-info.yaml`. A
 * `system-prompt-ref` is resolved relative to this. */
const LOCATION_ANNOTATION = 'backstage.io/managed-by-location';

/** A line whose sole content is `{{include: <path>}}` (leading/trailing
 * whitespace tolerated) is transcluded in place. */
const INCLUDE_RE = /^[ \t]*\{\{include:\s*(.+?)\s*\}\}[ \t]*$/;

export interface PersonaPromptDeps {
  reader: UrlReaderService;
  scm: ScmIntegrationRegistry;
}

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

/** Strip a leading YAML frontmatter block (`---` … `---`) if present. The
 * frontmatter on a persona SKILL.md is documentary only (name/description);
 * the body is the prompt. */
function stripFrontmatter(text: string): string {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/);
  return m ? text.slice(m[0].length) : text;
}

/** Read a Markdown file by URL and expand its `{{include}}` directives
 * recursively. `ancestors` is the chain of URLs currently being expanded,
 * used to detect (and reject) include cycles. Each include path is resolved
 * relative to the file that contains the directive. */
async function expandFile(
  url: string,
  deps: PersonaPromptDeps,
  ancestors: readonly string[],
): Promise<string> {
  if (ancestors.includes(url)) {
    throw new Error(`include cycle: ${[...ancestors, url].join(' -> ')}`);
  }
  const chain = [...ancestors, url];
  const response = await deps.reader.readUrl(url);
  const raw = (await response.buffer()).toString('utf8');
  const body = stripFrontmatter(raw);

  const out: string[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(INCLUDE_RE);
    if (!match) {
      out.push(line);
      continue;
    }
    const childUrl = deps.scm.resolveUrl({ url: match[1], base: url });
    out.push(await expandFile(childUrl, deps, chain));
  }
  return out.join('\n');
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
export async function resolveSystemPrompt(
  entity: Entity,
  deps: PersonaPromptDeps,
): Promise<string | undefined> {
  const ref = annotation(entity, 'system-prompt-ref');
  if (ref) {
    const location = entity.metadata.annotations?.[LOCATION_ANNOTATION];
    if (!location) {
      throw new Error(
        `persona ${entity.metadata.name} has a system-prompt-ref but no ${LOCATION_ANNOTATION} to resolve it against`,
      );
    }
    // Location annotations are prefixed by kind, e.g. `url:https://…`. The
    // ref resolves against the file tree rooted at that location.
    const base = location.replace(/^(url|file):/, '');
    const url = deps.scm.resolveUrl({ url: ref, base });
    const expanded = await expandFile(url, deps, []);
    return expanded.trim();
  }
  return annotation(entity, 'system-prompt');
}
