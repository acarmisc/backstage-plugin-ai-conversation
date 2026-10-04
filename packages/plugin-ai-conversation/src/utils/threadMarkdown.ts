import { extractText } from '../hooks/messageShape';
import type { Thread, Citation } from '../types';

/**
 * Convert a thread to a Markdown representation suitable for export or sharing.
 * Format:
 * - # Thread title
 * - Metadata line (model, date)
 * - Each message as `**You:** / **Assistant (<model>):**` + text
 * - Sources section after assistant messages with citations
 */
export function threadToMarkdown(thread: Thread): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${thread.title}`);
  lines.push('');

  // Metadata line
  const date = new Date(thread.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  lines.push(`**Model:** ${thread.model} | **Date:** ${date}`);
  lines.push('');

  // Messages
  for (const message of thread.messages) {
    const text = extractText(message);
    if (message.role === 'user') {
      lines.push(`**You:** ${text}`);
    } else if (message.role === 'assistant') {
      const modelLabel = message.metadata?.compareModel || thread.model;
      lines.push(`**Assistant (${modelLabel}):** ${text}`);

      // Check for citations in this message
      const citationsPart = message.parts.find(p => (p as any).type === 'data-citations');
      if (citationsPart) {
        const citations = (citationsPart as any).data as Citation[];
        if (Array.isArray(citations) && citations.length > 0) {
          lines.push('');
          lines.push('**Sources:**');
          // Deduplicate by filename
          const seen = new Set<string>();
          for (const citation of citations) {
            if (seen.has(citation.filename)) continue;
            seen.add(citation.filename);
            const source = citation.source ? ` (${citation.source})` : '';
            lines.push(`- ${citation.filename}${source}: ${citation.snippet}`);
          }
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Helper to download a file in the browser.
 * @param filename - File name to download as
 * @param mimeType - MIME type (e.g. 'application/json')
 * @param content - File content as string
 */
export function downloadFile(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
