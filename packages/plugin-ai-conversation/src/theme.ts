export const ACCENT_START = '#7C5CFC';
export const ACCENT_END = '#22D3EE';

export const ACCENT_GRADIENT = `linear-gradient(135deg, ${ACCENT_START}, ${ACCENT_END})`;

export const ACCENT_CONIC_GRADIENT = `conic-gradient(from 0deg, ${ACCENT_START}, ${ACCENT_END}, ${ACCENT_START})`;

export const MONO_FONT_STACK =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const JETBRAINS_MONO_URL =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap';
const KATEX_CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';

function injectStylesheetOnce(id: string, href: string) {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Loads the JetBrains Mono webfont and KaTeX stylesheet via <link> tags
 * rather than bundling them (the esbuild build.js pipeline has no CSS
 * loader configured). Requires the host Backstage CSP to allow
 * fonts.googleapis.com/fonts.gstatic.com and cdn.jsdelivr.net — same
 * pattern as the connect-src additions documented in HANDOFF.md.
 */
export function injectDesignSystemAssets() {
  injectStylesheetOnce('ai-conversation-jetbrains-mono', JETBRAINS_MONO_URL);
  injectStylesheetOnce('ai-conversation-katex-css', KATEX_CSS_URL);
}
