import { Entity } from '@backstage/catalog-model';
import { AuthService, UrlReaderService } from '@backstage/backend-plugin-api';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { ScmIntegrationRegistry } from '@backstage/integration';
import { SkillSummary } from './types';
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
export declare function parseFrontmatter(text: string): {
    meta: SkillFrontmatter;
    body: string;
};
/** Map a catalog entity to the metadata shown in the frontend picker. Does
 * not include the system prompt — see `resolveSystemPrompt`.
 *
 * `meta` is the entity's `SKILL.md` frontmatter, when it could be loaded:
 * each field there is a fallback used only where the corresponding catalog
 * annotation / metadata is absent, so a one-line `catalog-info.yaml` plus a
 * rich `SKILL.md` is enough to describe a skill (Tier 2). Annotations still
 * win when both are set. `defaultVectorStoreIds` stays as raw store
 * *names* here; the router resolves them to ids. */
export declare function entityToSkillSummary(entity: Entity, meta?: SkillFrontmatter): SkillSummary;
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
export declare function resolveSystemPrompt(entity: Entity, deps: SkillPromptDeps): Promise<string | undefined>;
/** Fetch just the frontmatter of an entity's `SKILL.md` — no `{{include}}`
 * expansion, best-effort. Feeds `entityToSkillSummary`'s Tier 2 fallback so
 * a bare `catalog-info.yaml` can lean on its `SKILL.md` for description /
 * model / KB defaults. Returns `{}` on any failure. */
export declare function loadEntityFrontmatter(entity: Entity, deps: SkillPromptDeps): Promise<SkillFrontmatter>;
/** Id prefix for skills discovered from a plain directory rather than the
 * catalog. Kept distinct from a catalog entity ref (`component:ns/name`)
 * so `resolvePrompt` can tell the two apart without a lookup. */
export declare const BUNDLED_SKILL_ID_PREFIX = "skill:bundled/";
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
export declare function bundledSkillSource(rootDir: string): SkillSource;
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
export declare function catalogSkillSource(opts: CatalogSkillSourceOptions): SkillSource;
