"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERBOSITY_OPTIONS = exports.FOCUS_OPTIONS = exports.TONE_OPTIONS = void 0;
exports.resolveTrait = resolveTrait;
exports.TONE_OPTIONS = [
    {
        id: 'friendly',
        label: 'Friendly',
        prompt: 'Tone: warm, encouraging, conversational.',
    },
    {
        id: 'formal',
        label: 'Formal',
        prompt: 'Tone: precise, professional, formal register.',
    },
    {
        id: 'direct',
        label: 'Direct',
        prompt: 'Tone: blunt and to the point — no hedging, no filler.',
    },
    {
        id: 'socratic',
        label: 'Socratic',
        prompt: 'Tone: mentor-style — ask a clarifying or guiding question before giving the answer when the question is ambiguous or underspecified.',
    },
    {
        id: 'playful',
        label: 'Playful',
        prompt: 'Tone: light, witty, occasional humor — stay accurate throughout.',
    },
];
exports.FOCUS_OPTIONS = [
    {
        id: 'explain',
        label: 'Explain reasoning',
        prompt: 'Focus: prioritize explaining the reasoning and trade-offs behind the answer, not just the answer itself.',
    },
    {
        id: 'actionable',
        label: 'Actionable',
        prompt: 'Focus: prioritize a concrete, actionable recommendation or next step over background.',
    },
    {
        id: 'code',
        label: 'Code-first',
        prompt: 'Focus: prioritize code examples and concrete snippets over prose explanation.',
    },
    {
        id: 'business',
        label: 'Business impact',
        prompt: 'Focus: frame the answer in terms of business impact, cost, and risk rather than technical detail.',
    },
    {
        id: 'risk',
        label: 'Risk & edge cases',
        prompt: 'Focus: proactively call out edge cases, risks, and failure modes.',
    },
];
exports.VERBOSITY_OPTIONS = [
    {
        id: 'concise',
        label: 'Concise',
        prompt: 'Length: be concise — short answers, no repetition, no unnecessary preamble.',
    },
    {
        id: 'balanced',
        label: 'Balanced',
        prompt: 'Length: balance completeness and brevity.',
    },
    {
        id: 'thorough',
        label: 'Thorough',
        prompt: 'Length: be thorough and comprehensive — include context, caveats, and examples.',
    },
];
/** Resolve a trait id to its prompt fragment. Throws with a `status` field
 * (mirroring persona_id validation) if `id` is set but unknown — ids only
 * ever come from the fixed lists above, so an unknown id means client/server
 * drift, not user input to sanitize. Returns undefined when `id` is unset. */
function resolveTrait(options, id) {
    if (!id)
        return undefined;
    const found = options.find(o => o.id === id);
    if (!found) {
        throw Object.assign(new Error(`invalid trait id: ${id}`), { status: 400 });
    }
    return found.prompt;
}
