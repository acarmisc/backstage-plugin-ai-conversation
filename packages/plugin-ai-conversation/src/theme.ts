
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
 * Loads the KaTeX stylesheet via <link> tag rather than bundling it
 * (the esbuild build.js pipeline has no CSS loader configured).
 * Requires the host Backstage CSP to allow cdn.jsdelivr.net.
 */
export function injectDesignSystemAssets() {
  injectStylesheetOnce('ai-conversation-katex-css', KATEX_CSS_URL);
}
