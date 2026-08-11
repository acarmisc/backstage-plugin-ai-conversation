export interface FetchedUrlContext {
    url: string;
    title: string;
    text: string;
}
/** Fetches `rawUrl` with SSRF guards and returns extracted title + text,
 * capped at `maxChars`. Each redirect hop (up to MAX_REDIRECTS) is
 * independently re-validated — https-only, public-address-only — before
 * being followed. */
export declare function fetchUrlContext(rawUrl: string, maxChars?: number): Promise<FetchedUrlContext>;
