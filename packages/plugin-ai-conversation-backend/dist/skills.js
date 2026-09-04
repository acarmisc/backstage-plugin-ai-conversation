"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUNDLED_SKILL_ID_PREFIX = void 0;
exports.parseFrontmatter = parseFrontmatter;
exports.entityToSkillSummary = entityToSkillSummary;
exports.resolveSystemPrompt = resolveSystemPrompt;
exports.loadEntityFrontmatter = loadEntityFrontmatter;
exports.bundledSkillSource = bundledSkillSource;
exports.catalogSkillSource = catalogSkillSource;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const yaml_1 = require("yaml");
const types_1 = require("./types");
/** Catalog annotation Backstage stamps with the entity's source location,
 * e.g. `url:https://github.com/org/repo/blob/main/catalog-info.yaml`. A
 * `system-prompt-ref` is resolved relative to this. */
const LOCATION_ANNOTATION = 'backstage.io/managed-by-location';
/** A line whose sole content is `{{include: <path>}}` (leading/trailing
 * whitespace tolerated) is transcluded in place. */
const INCLUDE_RE = /^[ \t]*\{\{include:\s*(.+?)\s*\}\}[ \t]*$/;
/** Splits a leading `---` … `---` YAML frontmatter block off a Markdown
 * string. Returns parsed `meta` (empty when absent or unparseable — a
 * malformed block is never fatal) and the remaining `body`. */
function parseFrontmatter(text) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/);
    if (!m)
        return { meta: {}, body: text };
    let meta = {};
    try {
        const parsed = (0, yaml_1.parse)(m[1]);
        if (parsed && typeof parsed === 'object')
            meta = parsed;
    }
    catch {
        // leave meta empty — the body is what matters for the prompt
    }
    return { meta, body: text.slice(m[0].length) };
}
function asStringArray(v) {
    if (!Array.isArray(v))
        return undefined;
    const out = v.map(String).map(s => s.trim()).filter(Boolean);
    return out.length ? out : undefined;
}
function annotation(entity, key) {
    return entity.metadata.annotations?.[`${types_1.CHAT_SKILL_ANNOTATION_PREFIX}/${key}`];
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
/** Strip a leading YAML frontmatter block (`---` … `---`) if present. The
 * frontmatter on a skill SKILL.md is metadata (see `parseFrontmatter`);
 * the body is the prompt. */
function stripFrontmatter(text) {
    return parseFrontmatter(text).body;
}
/** Read a Markdown file by URL and expand its `{{include}}` directives
 * recursively. `ancestors` is the chain of URLs currently being expanded,
 * used to detect (and reject) include cycles. Each include path is resolved
 * relative to the file that contains the directive. */
async function expandFile(url, deps, ancestors) {
    if (ancestors.includes(url)) {
        throw new Error(`include cycle: ${[...ancestors, url].join(' -> ')}`);
    }
    const chain = [...ancestors, url];
    const response = await deps.reader.readUrl(url);
    const raw = (await response.buffer()).toString('utf8');
    const body = stripFrontmatter(raw);
    const out = [];
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
function entityToSkillSummary(entity, meta) {
    return {
        id: entityRef(entity),
        title: entity.metadata.title ?? meta?.name ?? entity.metadata.name,
        description: entity.metadata.description ?? meta?.description,
        defaultModel: annotation(entity, 'default-model') ?? meta?.model,
        defaultVectorStoreIds: splitCsv(annotation(entity, 'default-vector-stores')) ?? asStringArray(meta?.vectorStores),
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
async function resolveSystemPrompt(entity, deps) {
    const ref = annotation(entity, 'system-prompt-ref');
    if (ref) {
        const location = entity.metadata.annotations?.[LOCATION_ANNOTATION];
        if (!location) {
            throw new Error(`skill ${entity.metadata.name} has a system-prompt-ref but no ${LOCATION_ANNOTATION} to resolve it against`);
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
function systemPromptRefUrl(entity, deps) {
    const ref = annotation(entity, 'system-prompt-ref');
    if (!ref)
        return undefined;
    const location = entity.metadata.annotations?.[LOCATION_ANNOTATION];
    if (!location)
        return undefined;
    return deps.scm.resolveUrl({ url: ref, base: location.replace(/^(url|file):/, '') });
}
/** Fetch just the frontmatter of an entity's `SKILL.md` — no `{{include}}`
 * expansion, best-effort. Feeds `entityToSkillSummary`'s Tier 2 fallback so
 * a bare `catalog-info.yaml` can lean on its `SKILL.md` for description /
 * model / KB defaults. Returns `{}` on any failure. */
async function loadEntityFrontmatter(entity, deps) {
    const url = systemPromptRefUrl(entity, deps);
    if (!url)
        return {};
    try {
        const response = await deps.reader.readUrl(url);
        const raw = (await response.buffer()).toString('utf8');
        return parseFrontmatter(raw).meta;
    }
    catch {
        return {};
    }
}
/** Same `{{include}}` expansion as `expandFile`, but reading from the local
 * filesystem — used for bundled skills, whose `SKILL.md` and its includes
 * ship inside this package rather than an SCM tree. Paths in an `{{include}}`
 * are resolved relative to the file that names them; escaping the bundled
 * root (`..`, absolute paths) is rejected. */
async function expandLocalFile(filePath, rootDir, ancestors) {
    if (ancestors.includes(filePath)) {
        throw new Error(`include cycle: ${[...ancestors, filePath].join(' -> ')}`);
    }
    const chain = [...ancestors, filePath];
    const raw = await fs_1.promises.readFile(filePath, 'utf8');
    const body = parseFrontmatter(raw).body;
    const out = [];
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
exports.BUNDLED_SKILL_ID_PREFIX = 'skill:bundled/';
/**
 * Tier 1 — skills authored as a directory of `<slug>/SKILL.md` files that
 * ship with the plugin (or any other local path). Zero catalog wiring, so
 * the picker is never empty on a fresh install and there's a worked
 * reference for the `SKILL.md` format. Metadata comes entirely from the
 * frontmatter.
 */
function bundledSkillSource(rootDir) {
    const slugOf = (id) => id.slice(exports.BUNDLED_SKILL_ID_PREFIX.length);
    const fileFor = (slug) => path.join(rootDir, slug, 'SKILL.md');
    return {
        name: `bundled(${rootDir})`,
        async list() {
            let entries;
            try {
                entries = await fs_1.promises.readdir(rootDir, { withFileTypes: true });
            }
            catch {
                return []; // directory absent — nothing bundled
            }
            const skills = await Promise.all(entries
                .filter(e => e.isDirectory())
                .map(async (e) => {
                let raw;
                try {
                    raw = await fs_1.promises.readFile(fileFor(e.name), 'utf8');
                }
                catch {
                    return undefined; // no SKILL.md in this dir
                }
                const { meta } = parseFrontmatter(raw);
                return {
                    id: `${exports.BUNDLED_SKILL_ID_PREFIX}${e.name}`,
                    title: meta.name ?? e.name,
                    description: meta.description,
                    defaultModel: meta.model,
                    defaultVectorStoreIds: asStringArray(meta.vectorStores),
                    tags: asStringArray(meta.tags),
                };
            }));
            return skills.filter((s) => !!s);
        },
        async resolvePrompt(id) {
            if (!id.startsWith(exports.BUNDLED_SKILL_ID_PREFIX))
                return undefined;
            const slug = slugOf(id);
            if (!/^[a-z0-9._-]+$/i.test(slug))
                return undefined;
            try {
                // expandLocalFile reads the file, strips frontmatter, and expands
                // any {{include}} relative to it.
                const expanded = await expandLocalFile(fileFor(slug), rootDir, []);
                return expanded.trim() || undefined;
            }
            catch {
                return undefined; // missing SKILL.md, include cycle, escape attempt
            }
        },
    };
}
const CATALOG_FRONTMATTER_TTL_MS = 5 * 60 * 1000;
/**
 * Tier 2 — skills as catalog `Component` entities of type `chat-skill`,
 * discovered by whatever catalog providers the host app already runs
 * (GitLab/GitHub locations, etc.). Ownership, tags and RBAC come from the
 * catalog for free. When an entity omits the `default-model` /
 * `default-vector-stores` / `description` metadata, its `SKILL.md`
 * frontmatter fills the gap (cached briefly, best-effort).
 */
function catalogSkillSource(opts) {
    const { catalog, auth, promptDeps } = opts;
    const frontmatterCache = new Map();
    const needsFallback = (entity) => !!annotation(entity, 'system-prompt-ref') &&
        (!entity.metadata.description ||
            !annotation(entity, 'default-model') ||
            !annotation(entity, 'default-vector-stores'));
    const frontmatterFor = async (entity) => {
        const key = entityRef(entity);
        const hit = frontmatterCache.get(key);
        if (hit && hit.expiresAt > Date.now())
            return hit.meta;
        const meta = await loadEntityFrontmatter(entity, promptDeps);
        frontmatterCache.set(key, { meta, expiresAt: Date.now() + CATALOG_FRONTMATTER_TTL_MS });
        return meta;
    };
    return {
        name: 'catalog',
        async list() {
            const credentials = await auth.getOwnServiceCredentials();
            const { items } = await catalog.getEntities({ filter: { kind: 'Component', 'spec.type': types_1.CHAT_SKILL_TYPE } }, { credentials });
            return Promise.all(items.map(async (entity) => entityToSkillSummary(entity, needsFallback(entity) ? await frontmatterFor(entity) : undefined)));
        },
        async resolvePrompt(id) {
            if (id.startsWith(exports.BUNDLED_SKILL_ID_PREFIX))
                return undefined;
            const credentials = await auth.getOwnServiceCredentials();
            const entity = await catalog.getEntityByRef(id, { credentials });
            if (!entity || entity.spec?.type !== types_1.CHAT_SKILL_TYPE)
                return undefined;
            return (await resolveSystemPrompt(entity, promptDeps)) || undefined;
        },
    };
}
