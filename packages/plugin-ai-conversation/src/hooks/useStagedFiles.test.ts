import {
  partitionAttachments,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  ALLOWED_ATTACHMENT_MEDIA_TYPES,
} from './useStagedFiles';

describe('partitionAttachments', () => {
  it('accepts PNG, JPEG, WebP, and GIF files', () => {
    const files = [
      new File([new Uint8Array(100)], 'a.png', { type: 'image/png' }),
      new File([new Uint8Array(100)], 'b.jpg', { type: 'image/jpeg' }),
      new File([new Uint8Array(100)], 'c.webp', { type: 'image/webp' }),
      new File([new Uint8Array(100)], 'd.gif', { type: 'image/gif' }),
    ];
    const { accepted, error } = partitionAttachments(files, 0);
    expect(accepted).toHaveLength(4);
    expect(error).toBeNull();
  });

  it('rejects a PDF file with an error message mentioning only PNG, JPEG, WebP and GIF', () => {
    const files = [
      new File([new Uint8Array(100)], 'doc.pdf', { type: 'application/pdf' }),
      new File([new Uint8Array(100)], 'image.png', { type: 'image/png' }),
    ];
    const { accepted, error } = partitionAttachments(files, 0);
    expect(error).not.toBeNull();
    expect(error).toContain('PNG');
    expect(error).toContain('JPEG');
    expect(error).toContain('WebP');
    expect(error).toContain('GIF');
    expect(error).not.toContain('PDF');
    expect(accepted).toHaveLength(1);
    expect(accepted[0].name).toBe('image.png');
  });

  it('rejects a file larger than MAX_ATTACHMENT_BYTES', () => {
    const file = new File([new Uint8Array(100)], 'large.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: MAX_ATTACHMENT_BYTES + 1 });
    const { accepted, error } = partitionAttachments([file], 0);
    expect(error).not.toBeNull();
    expect(error).toContain('too large');
    expect(accepted).toHaveLength(0);
  });

  it('enforces MAX_ATTACHMENTS_PER_MESSAGE counting alreadyStaged', () => {
    const files = [
      new File([new Uint8Array(100)], 'a.png', { type: 'image/png' }),
      new File([new Uint8Array(100)], 'b.png', { type: 'image/png' }),
    ];
    const { accepted, error } = partitionAttachments(files, MAX_ATTACHMENTS_PER_MESSAGE - 1);
    expect(error).not.toBeNull();
    expect(error).toContain(`up to ${MAX_ATTACHMENTS_PER_MESSAGE}`);
    expect(accepted).toHaveLength(1);
  });

  it('returns null error when all files are accepted', () => {
    const files = [
      new File([new Uint8Array(100)], 'a.png', { type: 'image/png' }),
      new File([new Uint8Array(100)], 'b.jpg', { type: 'image/jpeg' }),
    ];
    const { accepted, error } = partitionAttachments(files, 0);
    expect(error).toBeNull();
    expect(accepted).toHaveLength(2);
  });

  it('returns the first error encountered', () => {
    const file1 = new File([new Uint8Array(100)], 'invalid.pdf', { type: 'application/pdf' });
    const file2 = new File([new Uint8Array(100)], 'large.png', { type: 'image/png' });
    Object.defineProperty(file2, 'size', { value: MAX_ATTACHMENT_BYTES + 1 });
    const { accepted, error } = partitionAttachments([file1, file2], 0);
    expect(error).not.toBeNull();
    expect(error).toContain('PNG, JPEG, WebP and GIF');
    expect(error).not.toContain('too large');
    expect(accepted).toHaveLength(0);
  });

  it('respects MAX_ATTACHMENTS_PER_MESSAGE as an absolute limit', () => {
    const files = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 1 }, (_, i) =>
      new File([new Uint8Array(100)], `img${i}.png`, { type: 'image/png' }),
    );
    const { accepted, error } = partitionAttachments(files, 0);
    expect(error).not.toBeNull();
    expect(accepted).toHaveLength(MAX_ATTACHMENTS_PER_MESSAGE);
  });

  it('allows valid files when alreadyStaged plus accepted stays at the limit', () => {
    const files = [
      new File([new Uint8Array(100)], 'a.png', { type: 'image/png' }),
    ];
    const { accepted, error } = partitionAttachments(files, MAX_ATTACHMENTS_PER_MESSAGE - 1);
    expect(error).toBeNull();
    expect(accepted).toHaveLength(1);
  });

  it('handles an empty file list', () => {
    const { accepted, error } = partitionAttachments([], 0);
    expect(accepted).toHaveLength(0);
    expect(error).toBeNull();
  });

  it('preserves the order of accepted files', () => {
    const files = [
      new File([new Uint8Array(100)], 'z.png', { type: 'image/png' }),
      new File([new Uint8Array(100)], 'a.jpg', { type: 'image/jpeg' }),
      new File([new Uint8Array(100)], 'm.webp', { type: 'image/webp' }),
    ];
    const { accepted } = partitionAttachments(files, 0);
    expect(accepted.map(f => f.name)).toEqual(['z.png', 'a.jpg', 'm.webp']);
  });
});
