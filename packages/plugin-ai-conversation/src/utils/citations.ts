import type { AiConversationUIMessage, Citation } from '../types';

/**
 * Finds the last assistant message with citations and extracts them.
 * Used to populate the Sources panel when live stream citations are not available.
 */
export function citationsFromLastAssistant(messages: AiConversationUIMessage[]): Citation[] {
  // Search backwards for the last assistant message with citations
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;

    // Look for data-citations part
    const citationsPart = message.parts.find((p): p is any => p.type === 'data-citations');
    if (!citationsPart || !citationsPart.data) continue;

    // Map the citations data to our Citation interface
    const data = citationsPart.data;
    if (Array.isArray(data)) {
      return data.map((r: any) => {
        // Determine source: if url is present, it's web; otherwise kb (or undefined)
        let source: 'kb' | 'web' | undefined;
        if (r.url) {
          source = 'web';
        } else if (r.source === 'web') {
          source = 'web';
        } else {
          source = 'kb';
        }
        return {
          filename: r.filename || r.title || 'Unknown',
          score: r.score ?? r.relevance_score ?? 0,
          snippet: r.text ?? r.snippet ?? '',
          source,
          url: r.url,
        };
      });
    }
  }

  return [];
}
