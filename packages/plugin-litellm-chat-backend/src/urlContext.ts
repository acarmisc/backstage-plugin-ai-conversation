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

function intToIpv4(addr: number): string {
  return [addr >>> 24, (addr >>> 16) & 0xff, (addr >>> 8) & 0xff, addr & 0xff].join('.');
}

function isPrivateIPv4(ip: string): boolean {
  const addr = ipv4ToInt(ip);
  return IPV4_BLOCKED_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (addr & mask) === (ipv4ToInt(base) & mask);
  });
}

/**
 * Expands any textual IPv6 form — compressed (`::1`), fully written out
 * (`0:0:0:0:0:0:0:1`), or with a trailing dotted quad (`::ffff:127.0.0.1`)
 * — into its 8 numeric hextets. Matching on the raw string instead would
 * miss the non-canonical spellings of the very addresses this module
 * exists to block. Returns null for anything unparseable, which callers
 * treat as blocked.
 */
function ipv6Hextets(ip: string): number[] | null {
  let rest = ip.toLowerCase().split('%')[0]; // drop any zone id

  // A trailing dotted quad occupies the last two hextets.
  const dotted = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(rest);
  if (dotted) {
    if (!net.isIPv4(dotted[1])) return null;
    const v4 = ipv4ToInt(dotted[1]);
    rest = `${rest.slice(0, dotted.index)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }

  const parts = rest.split('::');
  if (parts.length > 2) return null;
  const toHextets = (part: string) =>
    part ? part.split(':').map(h => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN)) : [];
  const head = toHextets(parts[0]);
  const tail = parts.length === 2 ? toHextets(parts[1]) : [];
  const hextets =
    parts.length === 2
      ? [...head, ...new Array(Math.max(0, 8 - head.length - tail.length)).fill(0), ...tail]
      : head;
  if (hextets.length !== 8 || hextets.some(h => !Number.isInteger(h))) return null;
  return hextets;
}

function isPrivateIPv6(ip: string): boolean {
  const hextets = ipv6Hextets(ip);
  if (!hextets) return true; // unparseable — fail closed

  // IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible (::a.b.c.d) and NAT64
  // (64:ff9b::a.b.c.d) all carry a real IPv4 destination in the last two
  // hextets — judge those by the embedded address, not by the IPv6
  // prefix. `::` and `::1` fall out of this too, via 0.0.0.0/8.
  const embedded = ((hextets[6] << 16) >>> 0) + hextets[7];
  const zeroPrefix = hextets.slice(0, 5).every(h => h === 0);
  const isNat64 =
    hextets[0] === 0x64 && hextets[1] === 0xff9b && hextets.slice(2, 6).every(h => h === 0);
  if ((zeroPrefix && (hextets[5] === 0xffff || hextets[5] === 0)) || isNat64) {
    return isPrivateIPv4(intToIpv4(embedded));
  }

  const first = hextets[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

export function isBlockedAddress(ip: string): boolean {
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
  // URL.hostname keeps the brackets on an IPv6 literal ("[::1]"), which is
  // not something net.isIP/dns.lookup recognise — strip them so a literal
  // takes the address check below rather than falling through to a DNS
  // lookup that just fails with a misleading error.
  const host = hostname.replace(/^\[(.*)\]$/, '$1');
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) {
      throw Object.assign(new Error('URL resolves to a private address'), { status: 400 });
    }
    return;
  }
  const records = await dns.promises.lookup(host, { all: true, verbatim: true });
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

export function stripHtml(html: string): { title: string; text: string } {
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
