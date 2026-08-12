import { isBlockedAddress, stripHtml } from './urlContext';

describe('isBlockedAddress', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['10.0.0.5', 'RFC1918 10/8'],
    ['172.16.0.1', 'RFC1918 172.16/12'],
    ['192.168.1.1', 'RFC1918 192.168/16'],
    ['169.254.169.254', 'cloud metadata / link-local'],
    ['100.64.0.1', 'CGNAT'],
    ['0.0.0.0', 'unspecified'],
    ['255.255.255.255', 'broadcast'],
    ['224.0.0.1', 'multicast'],
  ])('blocks IPv4 %s (%s)', ip => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each([
    ['8.8.8.8', 'public DNS'],
    ['93.184.216.34', 'public host'],
  ])('allows IPv4 %s (%s)', ip => {
    expect(isBlockedAddress(ip)).toBe(false);
  });

  it.each([
    ['::1', 'loopback'],
    ['::', 'unspecified'],
    ['fc00::1', 'unique local fc00::/7'],
    ['fd12:3456:789a::1', 'unique local fd00::/8'],
    ['fe80::1', 'link-local'],
    ['ff02::1', 'multicast'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:169.254.169.254', 'IPv4-mapped cloud metadata'],
    // Non-canonical spellings of the addresses above — a textual match on
    // "::1"/"::ffff:<dotted quad>" alone would let every one of these
    // through, which is exactly the SSRF this guard exists to stop.
    ['0:0:0:0:0:0:0:1', 'fully expanded loopback'],
    ['0000:0000:0000:0000:0000:0000:0000:0001', 'zero-padded loopback'],
    ['::ffff:7f00:1', 'IPv4-mapped loopback written in hex'],
    ['::ffff:a9fe:a9fe', 'IPv4-mapped cloud metadata written in hex'],
    ['0:0:0:0:0:ffff:127.0.0.1', 'expanded IPv4-mapped loopback'],
    ['::127.0.0.1', 'IPv4-compatible loopback'],
    ['64:ff9b::169.254.169.254', 'NAT64-embedded cloud metadata'],
    ['fe80::1%eth0', 'link-local with a zone id'],
  ])('blocks IPv6 %s (%s)', ip => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each([
    ['2001:4860:4860::8888', 'public DNS'],
    ['::ffff:8.8.8.8', 'IPv4-mapped public'],
    ['::ffff:808:808', 'IPv4-mapped public written in hex'],
    ['2001:4860:4860:0:0:0:0:8888', 'fully expanded public'],
  ])('allows IPv6 %s (%s)', ip => {
    expect(isBlockedAddress(ip)).toBe(false);
  });

  it('fails closed on a non-IP string', () => {
    expect(isBlockedAddress('not-an-ip')).toBe(true);
  });
});

describe('stripHtml', () => {
  it('extracts the title and strips tags/scripts/styles into plain text', () => {
    const html = `
      <html>
        <head><title>Example Page</title><style>.a{color:red}</style></head>
        <body>
          <script>alert('x')</script>
          <h1>Heading</h1>
          <p>Hello <b>world</b>.</p>
        </body>
      </html>
    `;
    const { title, text } = stripHtml(html);
    expect(title).toBe('Example Page');
    expect(text).not.toContain('<');
    expect(text).not.toContain('alert(');
    expect(text).not.toContain('color:red');
    expect(text).toContain('Heading');
    expect(text).toContain('Hello');
    expect(text).toContain('world');
  });

  it('decodes common HTML entities', () => {
    const { text } = stripHtml('<p>Tom &amp; Jerry &quot;fun&quot; &lt;tag&gt;</p>');
    expect(text).toContain('Tom & Jerry');
    expect(text).toContain('"fun"');
    expect(text).toContain('<tag>');
  });

  it('returns an empty title when there is no <title> tag', () => {
    const { title } = stripHtml('<p>No title here</p>');
    expect(title).toBe('');
  });
});
