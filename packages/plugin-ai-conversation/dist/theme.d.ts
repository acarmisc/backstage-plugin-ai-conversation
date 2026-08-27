export declare const ACCENT_START = "#7C5CFC";
export declare const ACCENT_END = "#22D3EE";
export declare const ACCENT_GRADIENT = "linear-gradient(135deg, #7C5CFC, #22D3EE)";
export declare const ACCENT_CONIC_GRADIENT = "conic-gradient(from 0deg, #7C5CFC, #22D3EE, #7C5CFC)";
export declare const MONO_FONT_STACK = "\"JetBrains Mono\", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
/**
 * Loads the JetBrains Mono webfont and KaTeX stylesheet via <link> tags
 * rather than bundling them (the esbuild build.js pipeline has no CSS
 * loader configured). Requires the host Backstage CSP to allow
 * fonts.googleapis.com/fonts.gstatic.com and cdn.jsdelivr.net — same
 * pattern as the connect-src additions documented in HANDOFF.md.
 */
export declare function injectDesignSystemAssets(): void;
