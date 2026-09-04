import type { ChatMessage, SearchResult } from './types';

/**
 * Server-side retrieval for grounding. Two-step RAG against LiteLLM:
 * search each selected vector store, then inject the chunks as a system
 * message before the conversation. Replaces the old pass-through of
 * `vector_store_ids` on /v1/chat/completions — LiteLLM forwards that param
 * to Bedrock verbatim, and Bedrock managed KBs reject it ("Extra inputs are
 * not permitted"), as does /v1/rag/query (it builds
 * retrievalConfiguration.vectorSearchConfiguration, which Bedrock managed
 * KBs refuse in favor of managedSearchConfiguration). The OpenAI-style
 * /v1/vector_stores/{id}/search endpoint works on managed KBs when the
 * numberOfResults rides in extra_body retrievalConfiguration.
 * managedSearchConfiguration — LiteLLM's own `max_num_results` param injects
 * the vectorSearchConfiguration form instead and gets rejected, so it must
 * NOT be sent alongside the extra_body.
 */
export async function retrieveContext(opts: {
  baseUrl: string;
  userKey: string;
  vectorStoreIds: string[];
  query: string;
  topK: number;
}): Promise<SearchResult[]> {
  const { baseUrl, userKey, vectorStoreIds, query, topK } = opts;
  const search = (id: string, extra: Record<string, unknown> | null) =>
    fetch(`${baseUrl}/v1/vector_stores/${encodeURIComponent(id)}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userKey}`,
      },
      body: JSON.stringify(extra ? { query, extra_body: extra } : { query }),
      signal: AbortSignal.timeout(30_000),
    });

  const perStore = await Promise.all(
    vectorStoreIds.map(async id => {
      // Bedrock managed KBs need managedSearchConfiguration; stores on other
      // providers reject that param, so retry bare on a 400.
      let upstream = await search(id, {
        retrievalConfiguration: {
          managedSearchConfiguration: {
            managedSearchType: 'SEMANTIC',
            numberOfResults: topK,
          },
        },
      });
      if (!upstream.ok && upstream.status === 400) {
        upstream = await search(id, null);
      }
      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '');
        throw new Error(
          `vector store ${id} search ${upstream.status}: ${text || upstream.statusText}`,
        );
      }
      const data: any = await upstream.json();
      return (data.data ?? []).map(
        (r: any): SearchResult => ({
          filename:
            r.attributes?._document_title ?? r.filename ?? r.file_id ?? 'unknown',
          score: typeof r.score === 'number' ? r.score : 0,
          text: r.content?.[0]?.text ?? r.text ?? '',
          url: r.attributes?._source_uri,
        }),
      );
    }),
  );
  return perStore.flat();
}

/** Builds the grounding system message: one numbered block per chunk, so
 * the model can cite [n] and the frontend's SourcesPanel can list the same
 * filenames. */
export function buildContextMessage(results: SearchResult[]): ChatMessage {
  const context = results
    .map((r, i) => `[${i + 1}] ${r.filename}\n${r.text}`)
    .join('\n\n');
  return {
    id: 'kb-context',
    role: 'system',
    content:
      `Answer the user's question using the knowledge base excerpts below.` +
      `${results.length ? ' Cite sources as [n] where used.' : ''}` +
      `\n\n${context}`,
  };
}