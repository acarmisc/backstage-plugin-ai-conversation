import { promises as fs } from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { Entity } from '@backstage/catalog-model';
import { AuthService, UrlReaderService } from '@backstage/backend-plugin-api';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { ScmIntegrationRegistry } from '@backstage/integration';
import {
  CHAT_SKILL_ANNOTATION_PREFIX,
  CHAT_SKILL_TYPE,
  SkillSummary,
} from './types';

/** Catalog annotation Backstage stamps with the entity's source location,
 * e.g. `url:https://github.com/org/repo/blob/main/catalog-info.yaml`. A
 * `system-prompt-ref` is resolved relative to this. */
const LOCATION_ANNOTATION = 'backstage.io/managed-by-location';

/** A line whose sole content is `{{include: <path>}}` (leading/trailing
 * whitespace tolerated) is transcluded in place. */
const INCLUDE_RE = /^[ \t]*\{\{include:\s*(.+?)\s*\}\}[ \t]*$/;

export interface SkillPromptDeps {
  reader: UrlReaderService;
  scm: ScmIntegrationRegistry;
}

/**
 * The metadata half of a `SKILL.md` — its YAML frontmatter. Every field is
 * optional and advisory: it's a fallback for the catalog annotations (Tier
 * 2) and the only metadata source for skills discovered from a plain
 * directory (Tier 1, bundled). `vectorStores` holds human-written store
 * *names*; the router resolves them to ids the same way it does for
 * annotation-declared ones.
 */
export interface SkillFrontmatter {
  name?: string;
  description?: string;
  model?: string;
  vectorStores?: string[];
  tags?: string[];
}

/** Splits a leading `---` … `---` YAML frontmatter block off a Markdown
 * string. Returns parsed `meta` (empty when absent or unparseable — a
 * malformed block is never fatal) and the remaining `body`. */
export function parseFrontmatter(text: string): { meta: SkillFrontmatter; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/);
  if (!m) return { meta: {}, body: text };
  let meta: SkillFrontmatter = {};
  try {
    const parsed = parseYaml(m[1]);
    if (parsed && typeof parsed === 'object') meta = parsed as SkillFrontmatter;
  } catch {
    // leave meta empty — the body is what matters for the prompt
  }
  return { meta, body: text.slice(m[0].length) };
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.map(String).map(s => s.trim()).filter(Boolean);
  return out.length ? out : undefined;
}

function annotation(entity: Entity, key: string): string | undefined {
  return entity.metadata.annotations?.[`${CHAT_SKILL_ANNOTATION_PREFIX}/${key}`];
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
 * frontmatter on a skill SKILL.md is metadata (see `parseFrontmatter`);
 * the body is the prompt. */
function stripFrontmatter(text: string): string {
  return parseFrontmatter(text).body;
}

/** Read a Markdown file by URL and expand its `{{include}}` directives
 * recursively. `ancestors` is the chain of URLs currently being expanded,
 * used to detect (and reject) include cycles. Each include path is resolved
 * relative to the file that contains the directive. */
async function expandFile(
  url: string,
  deps: SkillPromptDeps,
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
 * not include the system prompt — see `resolveSystemPrompt`.
 *
 * `meta` is the entity's `SKILL.md` frontmatter, when it could be loaded:
 * each field there is a fallback used only where the corresponding catalog
 * annotation / metadata is absent, so a one-line `catalog-info.yaml` plus a
 * rich `SKILL.md` is enough to describe a skill (Tier 2). Annotations still
 * win when both are set. `defaultVectorStoreIds` stays as raw store
 * *names* here; the router resolves them to ids. */
export function entityToSkillSummary(entity: Entity, meta?: SkillFrontmatter): SkillSummary {
  return {
    id: entityRef(entity),
    title: entity.metadata.title ?? meta?.name ?? entity.metadata.name,
    description: entity.metadata.description ?? meta?.description,
    defaultModel: annotation(entity, 'default-model') ?? meta?.model,
    defaultVectorStoreIds:
      splitCsv(annotation(entity, 'default-vector-stores')) ?? asStringArray(meta?.vectorStores),
    tags: entity.metadata.tags ?? asStringArray(meta?.tags),
  };
}

/**
 * Resolve a skill entity to its system prompt string.
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
  deps: SkillPromptDeps,
): Promise<string | undefined> {
  const ref = annotation(entity, 'system-prompt-ref');
  if (ref) {
    const location = entity.metadata.annotations?.[LOCATION_ANNOTATION];
    if (!location) {
      throw new Error(
        `skill ${entity.metadata.name} has a system-prompt-ref but no ${LOCATION_ANNOTATION} to resolve it against`,
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

/** URL of an entity's `system-prompt-ref`, or undefined when it has none.
 * Shared by `resolveSystemPrompt` (via `expandFile`) and the frontmatter
 * fallback loader below. */
function systemPromptRefUrl(entity: Entity, deps: SkillPromptDeps): string | undefined {
  const ref = annotation(entity, 'system-prompt-ref');
  if (!ref) return undefined;
  const location = entity.metadata.annotations?.[LOCATION_ANNOTATION];
  if (!location) return undefined;
  return deps.scm.resolveUrl({ url: ref, base: location.replace(/^(url|file):/, '') });
}

/** Fetch just the frontmatter of an entity's `SKILL.md` — no `{{include}}`
 * expansion, best-effort. Feeds `entityToSkillSummary`'s Tier 2 fallback so
 * a bare `catalog-info.yaml` can lean on its `SKILL.md` for description /
 * model / KB defaults. Returns `{}` on any failure. */
export async function loadEntityFrontmatter(
  entity: Entity,
  deps: SkillPromptDeps,
): Promise<SkillFrontmatter> {
  const url = systemPromptRefUrl(entity, deps);
  if (!url) return {};
  try {
    const response = await deps.reader.readUrl(url);
    const raw = (await response.buffer()).toString('utf8');
    return parseFrontmatter(raw).meta;
  } catch {
    return {};
  }
}

/** Same `{{include}}` expansion as `expandFile`, but reading from the local
 * filesystem — used for bundled skills, whose `SKILL.md` and its includes
 * ship inside this package rather than an SCM tree. Paths in an `{{include}}`
 * are resolved relative to the file that names them; escaping the bundled
 * root (`..`, absolute paths) is rejected. */
async function expandLocalFile(
  filePath: string,
  rootDir: string,
  ancestors: readonly string[],
): Promise<string> {
  if (ancestors.includes(filePath)) {
    throw new Error(`include cycle: ${[...ancestors, filePath].join(' -> ')}`);
  }
  const chain = [...ancestors, filePath];
  const raw = await fs.readFile(filePath, 'utf8');
  const body = parseFrontmatter(raw).body;

  const out: string[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(INCLUDE_RE);
    if (!match) {
      out.push(line);
      continue;
    }
    const childPath = path.resolve(path.dirname(filePath), match[1]);
    const rel = path.relative(rootDir, childPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`include escapes skills root: ${match[1]}`);
    }
    out.push(await expandLocalFile(childPath, rootDir, chain));
  }
  return out.join('\n');
}

// ── Skill sources ───────────────────────────────────────────────────────

/** Id prefix for skills discovered from a plain directory rather than the
 * catalog. Kept distinct from a catalog entity ref (`component:ns/name`)
 * so `resolvePrompt` can tell the two apart without a lookup. */
export const BUNDLED_SKILL_ID_PREFIX = 'skill:bundled/';

/**
 * One place skills come from. `list()` yields picker metadata (system
 * prompt excluded — same contract as the catalog path); `resolvePrompt`
 * returns the composed prompt for an id this source owns, or `undefined`
 * when the id belongs to another source. `defaultVectorStoreIds` in a
 * summary is left as raw store *names* — the router resolves them.
 */
export interface SkillSource {
  readonly name: string;
  list(): Promise<SkillSummary[]>;
  resolvePrompt(id: string): Promise<string | undefined>;
}

/**
 * Tier 1 — skills authored as a directory of `<slug>/SKILL.md` files that
 * ship with the plugin (or any other local path). Zero catalog wiring, so
 * the picker is never empty on a fresh install and there's a worked
 * reference for the `SKILL.md` format. Metadata comes entirely from the
 * frontmatter.
 */
export function bundledSkillSource(rootDir: string): SkillSource {
  const slugOf = (id: string) => id.slice(BUNDLED_SKILL_ID_PREFIX.length);
  const fileFor = (slug: string) => path.join(rootDir, slug, 'SKILL.md');

  return {
    name: `bundled(${rootDir})`,
    async list() {
      let entries: import('fs').Dirent[];
      try {
        entries = await fs.readdir(rootDir, { withFileTypes: true });
      } catch {
        return []; // directory absent — nothing bundled
      }
      const skills = await Promise.all(
        entries
          .filter(e => e.isDirectory())
          .map(async (e): Promise<SkillSummary | undefined> => {
            let raw: string;
            try {
              raw = await fs.readFile(fileFor(e.name), 'utf8');
            } catch {
              return undefined; // no SKILL.md in this dir
            }
            const { meta } = parseFrontmatter(raw);
            return {
              id: `${BUNDLED_SKILL_ID_PREFIX}${e.name}`,
              title: meta.name ?? e.name,
              description: meta.description,
              defaultModel: meta.model,
              defaultVectorStoreIds: asStringArray(meta.vectorStores),
              tags: asStringArray(meta.tags),
            };
          }),
      );
      return skills.filter((s): s is SkillSummary => !!s);
    },
    async resolvePrompt(id) {
      if (!id.startsWith(BUNDLED_SKILL_ID_PREFIX)) return undefined;
      const slug = slugOf(id);
      if (!/^[a-z0-9._-]+$/i.test(slug)) return undefined;
      try {
        // expandLocalFile reads the file, strips frontmatter, and expands
        // any {{include}} relative to it.
        const expanded = await expandLocalFile(fileFor(slug), rootDir, []);
        return expanded.trim() || undefined;
      } catch {
        return undefined; // missing SKILL.md, include cycle, escape attempt
      }
    },
  };
}

const CATALOG_FRONTMATTER_TTL_MS = 5 * 60 * 1000;

export interface CatalogSkillSourceOptions {
  catalog: CatalogService;
  auth: AuthService;
  promptDeps: SkillPromptDeps;
}

/**
 * Tier 2 — skills as catalog `Component` entities of type `chat-skill`,
 * discovered by whatever catalog providers the host app already runs
 * (GitLab/GitHub locations, etc.). Ownership, tags and RBAC come from the
 * catalog for free. When an entity omits the `default-model` /
 * `default-vector-stores` / `description` metadata, its `SKILL.md`
 * frontmatter fills the gap (cached briefly, best-effort).
 */
export function catalogSkillSource(opts: CatalogSkillSourceOptions): SkillSource {
  const { catalog, auth, promptDeps } = opts;
  const frontmatterCache = new Map<string, { meta: SkillFrontmatter; expiresAt: number }>();

  const needsFallback = (entity: Entity) =>
    !!annotation(entity, 'system-prompt-ref') &&
    (!entity.metadata.description ||
      !annotation(entity, 'default-model') ||
      !annotation(entity, 'default-vector-stores'));

  const frontmatterFor = async (entity: Entity): Promise<SkillFrontmatter> => {
    const key = entityRef(entity);
    const hit = frontmatterCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.meta;
    const meta = await loadEntityFrontmatter(entity, promptDeps);
    frontmatterCache.set(key, { meta, expiresAt: Date.now() + CATALOG_FRONTMATTER_TTL_MS });
    return meta;
  };

  return {
    name: 'catalog',
    async list() {
      const credentials = await auth.getOwnServiceCredentials();
      const { items } = await catalog.getEntities(
        { filter: { kind: 'Component', 'spec.type': CHAT_SKILL_TYPE } },
        { credentials },
      );
      return Promise.all(
        items.map(async entity =>
          entityToSkillSummary(entity, needsFallback(entity) ? await frontmatterFor(entity) : undefined),
        ),
      );
    },
    async resolvePrompt(id) {
      if (id.startsWith(BUNDLED_SKILL_ID_PREFIX)) return undefined;
      const credentials = await auth.getOwnServiceCredentials();
      const entity = await catalog.getEntityByRef(id, { credentials });
      if (!entity || entity.spec?.type !== CHAT_SKILL_TYPE) return undefined;
      return (await resolveSystemPrompt(entity, promptDeps)) || undefined;
    },
  };
}
