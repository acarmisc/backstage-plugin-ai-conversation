/**
 * Static "trait" registries for the tone/focus/verbosity pickers.
 *
 * Unlike personas (self-service, catalog-authored, one prompt file per
 * team), these are a small, curated, slowly-changing vocabulary — the same
 * shape ChatGPT's "custom instructions" traits use. A fixed in-code list is
 * proportionate here; a catalog entity kind would be over-engineering for
 * ~5 options that change a few times a year.
 *
 * Only `id`/`label` are ever sent to the browser (see `/chat/traits` in
 * router.ts) — `prompt` is resolved server-side by id, same reasoning as
 * persona system prompts: the client can't inject arbitrary prompt text by
 * picking a trait, only select from a known-safe set.
 */
export interface TraitOption {
    id: string;
    label: string;
    prompt: string;
}
export declare const TONE_OPTIONS: TraitOption[];
export declare const FOCUS_OPTIONS: TraitOption[];
export declare const VERBOSITY_OPTIONS: TraitOption[];
/** Resolve a trait id to its prompt fragment. Throws with a `status` field
 * (mirroring persona_id validation) if `id` is set but unknown — ids only
 * ever come from the fixed lists above, so an unknown id means client/server
 * drift, not user input to sanitize. Returns undefined when `id` is unset. */
export declare function resolveTrait(options: TraitOption[], id: string | undefined): string | undefined;
