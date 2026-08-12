/**
 * Returns `url` only if it is a plain http(s) link, otherwise undefined.
 *
 * URLs rendered as `href` here don't all come from us: citation URLs are
 * whatever the model/LiteLLM put in a search result, and a message's
 * attachedUrl can come from an imported thread JSON file. A `javascript:`
 * (or `data:`) URL in either would execute on click, so anything that isn't
 * an http(s) URL is rendered as plain text instead of a link.
 */
export function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}
