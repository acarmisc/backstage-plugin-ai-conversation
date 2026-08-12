import { safeHref } from './safeUrl';

describe('safeHref', () => {
  it.each([
    'https://example.com/doc',
    'http://example.com/doc',
    'https://example.com/a?b=c#d',
  ])('passes through http(s) URL %s', url => {
    expect(safeHref(url)).toBe(url);
  });

  it.each([
    // eslint-disable-next-line no-script-url
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ])('rejects non-http(s) URL %s', url => {
    expect(safeHref(url)).toBeUndefined();
  });

  it('rejects unparseable input and empty values', () => {
    expect(safeHref('')).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });
});
