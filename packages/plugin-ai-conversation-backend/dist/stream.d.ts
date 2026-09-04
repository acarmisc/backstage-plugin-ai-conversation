import type { Response } from 'express';
export interface ProxySSEOptions {
    upstreamUrl: string;
    upstreamBody: unknown;
    userKey: string;
    res: Response;
    logger: any;
    /** Extra SSE `data:` events emitted after the headers but before the
     * upstream stream is piped — e.g. the retrieval results for this turn,
     * which arrive as a `search_results` event the frontend maps to its
     * sources panel. */
    prelude?: Array<Record<string, unknown>>;
}
export declare function proxySSE(opts: ProxySSEOptions): Promise<void>;
