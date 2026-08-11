import dns from 'dns';
import net from 'net';

const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const DEFAULT_MAX_CHARS = 6000;

export interface FetchedUrlContext {
  url: string;
  title: string;
  text: string;
}

// IPv4 ranges that must never be reachable from this ad-hoc fetch: loopback,
// RFC1918 private space, link-local (which on most clouds also serves the
// instance metadata endpoint at 169.254.169.254), CGNAT, and the various
// IANA reserved/test/multicast blocks. Fail closed on anything unlisted.
const IPV4_BLOCKED_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
  ['255.255.255.255', 32],
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const addr = ipv4ToInt(ip);
  return IPV4_BLOCKED_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (addr & mask) === (ipv4ToInt(base) & mask);
  });
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (net.isIPv4(mapped)) return isPrivateIPv4(mapped);
  }
  const firstHextet = parseInt(normalized.split(':')[0] || '0', 16);
  if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((firstHextet & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

function isBlockedAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true;
}

/**
 * Resolves `hostname` and rejects if it (or any of its resolved addresses)
 * is a private/loopback/link-local/reserved address — including the DNS
 * rebinding case where a public-looking hostname resolves to an internal
 * IP at fetch time. Called again on every redirect hop in fetchUrlContext,
 * so a 302 to an internal host can't bypass this.
 */
async function assertPublicHostname(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw Object.assign(new Error('URL resolves to a private address'), { status: 400 });
    }
    return;
  }
  const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) {
    throw Object.assign(new Error('URL host does not resolve'), { status: 400 });
  }
  for (const { address } of records) {
    if (isBlockedAddress(address)) {
      throw Object.assign(new Error('URL resolves to a private address'), { status: 400 });
    }
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'");
}

function stripHtml(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim().slice(0, 200) : '';
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|br|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const text = decodeEntities(withoutNoise)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title, text };
}

async function fetchOnce(url: string): Promise<{ status: number; location?: string; html: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw Object.assign(new Error('Only https:// URLs are allowed'), { status: 400 });
  }
  await assertPublicHostname(parsed.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(parsed.toString(), {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'BackstageLiteLLMChat/1.0 (+ad-hoc #url context fetch)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return { status: upstream.status, location: upstream.headers.get('location') ?? undefined, html: '' };
    }
    if (!upstream.ok) {
      throw Object.assign(new Error(`upstream returned ${upstream.status}`), { status: 502 });
    }
    const contentType = upstream.headers.get('content-type') ?? '';
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      throw Object.assign(new Error(`unsupported content-type: ${contentType}`), { status: 415 });
    }
    if (!upstream.body) return { status: upstream.status, html: '' };

    const reader = upstream.body.getReader();
    let received = 0;
    const chunks: Buffer[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw Object.assign(new Error('response exceeded the size limit'), { status: 413 });
      }
      chunks.push(Buffer.from(value));
    }
    return { status: upstream.status, html: Buffer.concat(chunks).toString('utf-8') };
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetches `rawUrl` with SSRF guards and returns extracted title + text,
 * capped at `maxChars`. Each redirect hop (up to MAX_REDIRECTS) is
 * independently re-validated — https-only, public-address-only — before
 * being followed. */
export async function fetchUrlContext(
  rawUrl: string,
  maxChars = DEFAULT_MAX_CHARS,
): Promise<FetchedUrlContext> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const { status, location, html } = await fetchOnce(current);
    if (status >= 300 && status < 400) {
      if (!location) {
        throw Object.assign(new Error('redirect with no Location header'), { status: 502 });
      }
      current = new URL(location, current).toString();
      continue;
    }
    const { title, text } = stripHtml(html);
    return { url: current, title: title || current, text: text.slice(0, maxChars) };
  }
  throw Object.assign(new Error('too many redirects'), { status: 400 });
}
