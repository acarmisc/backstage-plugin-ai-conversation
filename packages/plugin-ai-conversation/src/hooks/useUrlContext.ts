import { useCallback, useEffect, useState } from 'react';
import type { AiConversationApiInterface } from '../api';
import type { UrlContextPreview } from '../types';

/** Matches a `#https://…` token in the composer. Only https is offered —
 * the backend rejects anything else anyway (see urlContext.ts). */
export const URL_TOKEN_RE = /#(https:\/\/\S+)/;

const PREVIEW_DEBOUNCE_MS = 500;

export interface UrlContextState {
  preview: UrlContextPreview | null;
  loading: boolean;
  error: string | null;
  /** The URL currently resolved or being resolved, if any. */
  url: string | undefined;
  dismiss: () => void;
  reset: () => void;
}

/**
 * Watches the composer text for a `#https://…` token and resolves it to a
 * title/snippet preview through the backend's SSRF-guarded fetcher. The full
 * page text never reaches the browser — the same server-side cache is hit
 * again when the message is actually sent.
 *
 * Dismissing a URL suppresses re-fetching it for as long as it stays in the
 * input, so a failed fetch doesn't retry on every keystroke.
 */
export function useUrlContext(api: AiConversationApiInterface, input: string): UrlContextState {
  const [preview, setPreview] = useState<UrlContextPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const url = input.match(URL_TOKEN_RE)?.[1];

  useEffect(() => {
    if (!url) {
      setPreview(null);
      setError(null);
      setLoading(false);
      return undefined;
    }
    if (url === dismissed || url === preview?.url) return undefined;

    setLoading(true);
    setError(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .fetchUrlContext(url)
        .then(result => {
          if (cancelled) return;
          setPreview(result);
          setLoading(false);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setError(err.message ?? 'Failed to fetch that page');
          setLoading(false);
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, dismissed, api]);

  const dismiss = useCallback(() => {
    setDismissed(url ?? null);
    setPreview(null);
    setError(null);
  }, [url]);

  const reset = useCallback(() => {
    setPreview(null);
    setError(null);
    setDismissed(null);
    setLoading(false);
  }, []);

  return { preview, loading, error, url, dismiss, reset };
}
