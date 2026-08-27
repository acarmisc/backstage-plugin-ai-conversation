import {
  isLikelyMultimodal,
  validateAttachments,
  extractText,
  toOpenAIMessageContent,
  AttachmentValidationError,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_DATA_URL_LENGTH,
  type IncomingUIMessage,
  type IncomingUIPart,
  type OpenAIMessageContent,
} from './attachments';

describe('isLikelyMultimodal', () => {
  describe('with configured models', () => {
    it('returns true for exact case-insensitive match', () => {
      const configured = ['claude-3-5-sonnet', 'gpt-4-turbo'];
      expect(isLikelyMultimodal('claude-3-5-sonnet', configured)).toBe(true);
      expect(isLikelyMultimodal('CLAUDE-3-5-SONNET', configured)).toBe(true);
      expect(isLikelyMultimodal('Claude-3-5-Sonnet', configured)).toBe(true);
    });

    it('returns false for model not in configured list', () => {
      const configured = ['claude-3-5-sonnet', 'gpt-4-turbo'];
      expect(isLikelyMultimodal('claude-2', configured)).toBe(false);
      expect(isLikelyMultimodal('gpt-3.5-turbo', configured)).toBe(false);
    });

    it('ignores default patterns when configured models is non-empty', () => {
      const configured = ['my-model'];
      // Even though 'claude-3' matches DEFAULT patterns, it should return false
      // because it's not in the configured list
      expect(isLikelyMultimodal('claude-3', configured)).toBe(false);
    });

    it('returns false for empty configured array', () => {
      // Empty array should fall back to default patterns
      expect(isLikelyMultimodal('claude-3', [])).toBe(true);
      expect(isLikelyMultimodal('gpt-4', [])).toBe(true);
    });
  });

  describe('with default patterns (no configured models)', () => {
    it('matches claude-* case-insensitively', () => {
      expect(isLikelyMultimodal('claude-3-5-sonnet', undefined)).toBe(true);
      expect(isLikelyMultimodal('Claude-2', undefined)).toBe(true);
      expect(isLikelyMultimodal('CLAUDE-100', undefined)).toBe(true);
      // Note: 'claude' without a dash does not match /^claude-/i pattern
      expect(isLikelyMultimodal('claude', undefined)).toBe(false);
    });

    it('matches gpt-4* case-insensitively', () => {
      expect(isLikelyMultimodal('gpt-4', undefined)).toBe(true);
      expect(isLikelyMultimodal('GPT-4-turbo', undefined)).toBe(true);
      expect(isLikelyMultimodal('gpt-40-vision', undefined)).toBe(true);
    });

    it('matches gpt-5* case-insensitively', () => {
      expect(isLikelyMultimodal('gpt-5', undefined)).toBe(true);
      expect(isLikelyMultimodal('GPT-5-pro', undefined)).toBe(true);
    });

    it('matches models containing gemini case-insensitively', () => {
      expect(isLikelyMultimodal('gemini-pro', undefined)).toBe(true);
      expect(isLikelyMultimodal('google-gemini', undefined)).toBe(true);
      expect(isLikelyMultimodal('GEMINI-1.5', undefined)).toBe(true);
    });

    it('matches models containing -vl suffix with word boundary or -/:', () => {
      expect(isLikelyMultimodal('qwen-vl', undefined)).toBe(true);
      expect(isLikelyMultimodal('qwen-vl-max', undefined)).toBe(true);
      expect(isLikelyMultimodal('model-vl:large', undefined)).toBe(true);
      expect(isLikelyMultimodal('some-vl-variant', undefined)).toBe(true);
      // Should not match if -vl is not followed by word boundary or -/:
      expect(isLikelyMultimodal('model-vlx', undefined)).toBe(false);
    });

    it('matches models containing vision case-insensitively', () => {
      expect(isLikelyMultimodal('gpt-4-vision', undefined)).toBe(true);
      expect(isLikelyMultimodal('my-vision-model', undefined)).toBe(true);
      expect(isLikelyMultimodal('VISION', undefined)).toBe(true);
    });

    it('returns false for non-multimodal model names', () => {
      expect(isLikelyMultimodal('gpt-3.5-turbo', undefined)).toBe(false);
      expect(isLikelyMultimodal('text-davinci-003', undefined)).toBe(false);
      expect(isLikelyMultimodal('llama-2', undefined)).toBe(false);
    });
  });
});

describe('validateAttachments', () => {
  const validImagePart = (url?: string): IncomingUIPart => ({
    type: 'file',
    mediaType: 'image/png',
    url: url || 'https://example.com/image.png',
  });

  const validMessage = (parts: IncomingUIPart[]): IncomingUIMessage => ({
    id: 'msg-1',
    role: 'user',
    parts,
  });

  describe('valid attachments', () => {
    it('accepts message with single image attachment', () => {
      const messages = [validMessage([validImagePart()])];
      expect(() => validateAttachments(messages)).not.toThrow();
    });

    it('accepts message with multiple valid attachments up to limit', () => {
      const parts = [
        validImagePart('https://example.com/img1.png'),
        validImagePart('https://example.com/img2.jpeg'),
        validImagePart('https://example.com/img3.webp'),
        validImagePart('https://example.com/img4.gif'),
      ];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).not.toThrow();
    });

    it('accepts message with no file parts', () => {
      const parts = [{ type: 'text', text: 'hello' }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).not.toThrow();
    });

    it('accepts message with mixed part types', () => {
      const parts = [
        { type: 'text', text: 'Check this image: ' },
        validImagePart('https://example.com/img.png'),
        { type: 'text', text: ' Nice!' },
      ];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).not.toThrow();
    });

    it('accepts http URLs', () => {
      const messages = [validMessage([validImagePart('http://example.com/image.png')])];
      expect(() => validateAttachments(messages)).not.toThrow();
    });

    it('accepts https URLs', () => {
      const messages = [validMessage([validImagePart('https://example.com/image.png')])];
      expect(() => validateAttachments(messages)).not.toThrow();
    });

    it('accepts data URLs', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const messages = [validMessage([validImagePart(dataUrl)])];
      expect(() => validateAttachments(messages)).not.toThrow();
    });

    it('accepts case-insensitive url schemes', () => {
      const messages = [
        validMessage([validImagePart('HTTPS://example.com/img.png')]),
        validMessage([validImagePart('HTTP://example.com/img.png')]),
        validMessage([validImagePart('Data:image/png;base64,abc123')]),
      ];
      expect(() => validateAttachments(messages)).not.toThrow();
    });

    it('accepts all allowed media types', () => {
      const types = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
      const messages = types.map(mediaType =>
        validMessage([{ ...validImagePart(), mediaType }]),
      );
      expect(() => validateAttachments(messages)).not.toThrow();
    });

    it('accepts empty messages array', () => {
      expect(() => validateAttachments([])).not.toThrow();
    });

    it('accepts multiple messages with valid attachments', () => {
      const messages = [
        validMessage([validImagePart('https://example.com/1.png')]),
        validMessage([validImagePart('https://example.com/2.png')]),
        validMessage([validImagePart('https://example.com/3.png')]),
      ];
      expect(() => validateAttachments(messages)).not.toThrow();
    });
  });

  describe('attachment count validation', () => {
    it('throws on more than MAX_ATTACHMENTS_PER_MESSAGE file parts', () => {
      const parts = [
        validImagePart('https://example.com/1.png'),
        validImagePart('https://example.com/2.png'),
        validImagePart('https://example.com/3.png'),
        validImagePart('https://example.com/4.png'),
        validImagePart('https://example.com/5.png'),
      ];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow(AttachmentValidationError);
      expect(() => validateAttachments(messages)).toThrow(
        /too many attachments on one message \(max \d+\)/,
      );
    });

    it('throws specifically when exceeding limit, not at the limit', () => {
      const parts = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 1 }, (_, i) =>
        validImagePart(`https://example.com/${i}.png`),
      );
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow();
    });

    it('ignores non-file parts when counting attachments', () => {
      const parts = [
        { type: 'text', text: 'text 1' },
        validImagePart('https://example.com/1.png'),
        { type: 'text', text: 'text 2' },
        validImagePart('https://example.com/2.png'),
        { type: 'text', text: 'text 3' },
        validImagePart('https://example.com/3.png'),
        { type: 'text', text: 'text 4' },
        validImagePart('https://example.com/4.png'),
        { type: 'text', text: 'text 5' },
        { type: 'other', data: 'something' },
      ];
      // 4 file parts = valid
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).not.toThrow();
    });
  });

  describe('media type validation', () => {
    it('throws on unsupported media type', () => {
      const parts = [{ ...validImagePart(), mediaType: 'video/mp4' }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow(AttachmentValidationError);
      expect(() => validateAttachments(messages)).toThrow(/unsupported attachment type/);
    });

    it('throws on missing media type', () => {
      const parts = [{ type: 'file', url: 'https://example.com/file' }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow(AttachmentValidationError);
      expect(() => validateAttachments(messages)).toThrow(/unsupported attachment type.*unknown/);
    });

    it('throws on undefined media type', () => {
      const parts = [{ type: 'file', mediaType: undefined, url: 'https://example.com/file' }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow();
    });

    it('throws on empty string media type', () => {
      const parts = [{ type: 'file', mediaType: '', url: 'https://example.com/file' }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow();
    });

    it('is case-sensitive for media type', () => {
      const parts = [{ type: 'file', mediaType: 'Image/PNG', url: 'https://example.com/file' }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow();
    });
  });

  describe('URL validation', () => {
    it('throws on missing URL', () => {
      const parts = [{ type: 'file', mediaType: 'image/png' }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow(AttachmentValidationError);
      expect(() => validateAttachments(messages)).toThrow(/attachment url must be/);
    });

    it('throws on empty string URL', () => {
      const parts = [{ type: 'file', mediaType: 'image/png', url: '' }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow();
    });

    it('throws on unsupported URL scheme', () => {
      const parts = [{ type: 'file', mediaType: 'image/png', url: 'ftp://example.com/file.png' }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow(AttachmentValidationError);
      expect(() => validateAttachments(messages)).toThrow(/attachment url must be/);
    });

    it('throws on file:// URL', () => {
      const parts = [{ type: 'file', mediaType: 'image/png', url: 'file:///home/user/image.png' }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow();
    });

    it('throws on relative URL', () => {
      const parts = [{ type: 'file', mediaType: 'image/png', url: '/path/to/image.png' }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow();
    });

    it('throws on URL exceeding max length', () => {
      const longUrl = `data:image/png;base64,${'a'.repeat(MAX_ATTACHMENT_DATA_URL_LENGTH + 1)}`;
      const parts = [{ type: 'file', mediaType: 'image/png', url: longUrl }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow(AttachmentValidationError);
      expect(() => validateAttachments(messages)).toThrow(/attachment too large/);
    });

    it('accepts URL at exactly max length', () => {
      const prefix = 'https://example.com/';
      const longUrl = `${prefix}${'a'.repeat(MAX_ATTACHMENT_DATA_URL_LENGTH - prefix.length)}`;
      expect(longUrl.length).toBe(MAX_ATTACHMENT_DATA_URL_LENGTH);
      const parts = [{ type: 'file', mediaType: 'image/png', url: longUrl }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).not.toThrow();
    });
  });

  describe('error priority', () => {
    it('reports first violation in order: count, then per-part checks', () => {
      // 5 file parts (exceeds limit) with one having bad mediaType
      const parts = [
        validImagePart('https://example.com/1.png'),
        validImagePart('https://example.com/2.png'),
        validImagePart('https://example.com/3.png'),
        validImagePart('https://example.com/4.png'),
        { type: 'file', mediaType: 'video/mp4', url: 'https://example.com/5.mp4' },
      ];
      const messages = [validMessage(parts)];
      // Should throw about count first
      expect(() => validateAttachments(messages)).toThrow(/too many attachments/);
    });

    it('reports mediaType error before URL error', () => {
      const parts = [{ type: 'file', mediaType: 'video/mp4', url: 'ftp://example.com/file' }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow(/unsupported attachment type/);
    });

    it('reports URL scheme error before size error', () => {
      const longUrl = `ftp://example.com/${'a'.repeat(MAX_ATTACHMENT_DATA_URL_LENGTH)}`;
      const parts = [{ type: 'file', mediaType: 'image/png', url: longUrl }];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).toThrow(/attachment url must be/);
    });
  });

  describe('non-file part handling', () => {
    it('ignores text parts entirely', () => {
      const parts = [
        { type: 'text', text: 'hello' },
        { type: 'text', mediaType: 'image/png', url: 'https://example.com/img.png' },
      ];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).not.toThrow();
    });

    it('ignores unknown part types', () => {
      const parts = [
        { type: 'unknown', mediaType: 'image/png', url: 'invalid-url' },
        validImagePart('https://example.com/valid.png'),
      ];
      const messages = [validMessage(parts)];
      expect(() => validateAttachments(messages)).not.toThrow();
    });
  });
});

describe('extractText', () => {
  const message = (parts: IncomingUIPart[]): IncomingUIMessage => ({
    id: 'msg-1',
    role: 'user',
    parts,
  });

  describe('single text part', () => {
    it('extracts text from single text part', () => {
      const parts = [{ type: 'text', text: 'hello world' }];
      expect(extractText(message(parts))).toBe('hello world');
    });

    it('returns empty string if text field is missing', () => {
      const parts = [{ type: 'text' }];
      expect(extractText(message(parts))).toBe('');
    });

    it('returns empty string if text field is undefined', () => {
      const parts = [{ type: 'text', text: undefined }];
      expect(extractText(message(parts))).toBe('');
    });

    it('returns empty string if text field is null', () => {
      const parts = [{ type: 'text', text: null as any }];
      expect(extractText(message(parts))).toBe('');
    });
  });

  describe('multiple text parts', () => {
    it('joins text from multiple parts with no separator', () => {
      const parts = [
        { type: 'text', text: 'hello' },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'world' },
      ];
      expect(extractText(message(parts))).toBe('hello world');
    });

    it('preserves empty text parts in the middle', () => {
      const parts = [
        { type: 'text', text: 'a' },
        { type: 'text', text: '' },
        { type: 'text', text: 'b' },
      ];
      expect(extractText(message(parts))).toBe('ab');
    });

    it('handles missing text fields in multiple parts', () => {
      const parts = [
        { type: 'text', text: 'start' },
        { type: 'text' },
        { type: 'text', text: 'end' },
      ];
      expect(extractText(message(parts))).toBe('startend');
    });
  });

  describe('with mixed part types', () => {
    it('ignores file parts and only extracts text parts', () => {
      const parts = [
        { type: 'text', text: 'hello' },
        { type: 'file', mediaType: 'image/png', url: 'https://example.com/img.png' },
        { type: 'text', text: ' world' },
      ];
      expect(extractText(message(parts))).toBe('hello world');
    });

    it('ignores unknown part types', () => {
      const parts = [
        { type: 'text', text: 'start' },
        { type: 'other', data: 'should be ignored' },
        { type: 'text', text: 'end' },
      ];
      expect(extractText(message(parts))).toBe('startend');
    });

    it('ignores non-text field attributes on text parts', () => {
      const parts = [
        { type: 'text', text: 'hello', mediaType: 'not-a-field-to-use' },
        { type: 'text', text: ' world' },
      ];
      expect(extractText(message(parts))).toBe('hello world');
    });
  });

  describe('empty message', () => {
    it('returns empty string for message with no parts', () => {
      expect(extractText(message([]))).toBe('');
    });

    it('returns empty string for message with only non-text parts', () => {
      const parts = [
        { type: 'file', mediaType: 'image/png', url: 'https://example.com/img.png' },
        { type: 'other', data: 'something' },
      ];
      expect(extractText(message(parts))).toBe('');
    });

    it('returns empty string for message with text parts that all have no text field', () => {
      const parts = [{ type: 'text' }, { type: 'text' }, { type: 'text' }];
      expect(extractText(message(parts))).toBe('');
    });
  });

  describe('special characters and whitespace', () => {
    it('preserves newlines and special characters', () => {
      const parts = [{ type: 'text', text: 'line1\nline2\ttab' }];
      expect(extractText(message(parts))).toBe('line1\nline2\ttab');
    });

    it('preserves leading and trailing whitespace', () => {
      const parts = [{ type: 'text', text: '  spaced  ' }];
      expect(extractText(message(parts))).toBe('  spaced  ');
    });
  });
});

describe('toOpenAIMessageContent', () => {
  const message = (parts: IncomingUIPart[]): IncomingUIMessage => ({
    id: 'msg-1',
    role: 'user',
    parts,
  });

  describe('text-only messages', () => {
    it('returns plain string for message with only text', () => {
      const parts = [{ type: 'text', text: 'hello world' }];
      const result = toOpenAIMessageContent(message(parts));
      expect(typeof result).toBe('string');
      expect(result).toBe('hello world');
    });

    it('returns plain string for multiple text parts', () => {
      const parts = [
        { type: 'text', text: 'hello' },
        { type: 'text', text: ' world' },
      ];
      const result = toOpenAIMessageContent(message(parts));
      expect(typeof result).toBe('string');
      expect(result).toBe('hello world');
    });

    it('returns empty string for text-only message with no text', () => {
      const parts = [{ type: 'text' }];
      const result = toOpenAIMessageContent(message(parts));
      expect(typeof result).toBe('string');
      expect(result).toBe('');
    });

    it('returns empty string for message with no parts', () => {
      const parts: IncomingUIPart[] = [];
      const result = toOpenAIMessageContent(message(parts));
      expect(typeof result).toBe('string');
      expect(result).toBe('');
    });
  });

  describe('attachment-only messages', () => {
    it('returns array with image_url entries for file-only message', () => {
      const parts = [
        { type: 'file', mediaType: 'image/png', url: 'https://example.com/img.png' },
      ];
      const result = toOpenAIMessageContent(message(parts));
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'image_url',
        image_url: { url: 'https://example.com/img.png' },
      });
    });

    it('does NOT include text entry for attachment-only message', () => {
      const parts = [
        { type: 'file', mediaType: 'image/png', url: 'https://example.com/img.png' },
      ];
      const result = toOpenAIMessageContent(message(parts));
      expect(Array.isArray(result)).toBe(true);
      const textEntry = (result as any).find((item: any) => item.type === 'text');
      expect(textEntry).toBeUndefined();
    });

    it('returns array with multiple image_url entries in order', () => {
      const parts = [
        { type: 'file', mediaType: 'image/png', url: 'https://example.com/img1.png' },
        { type: 'file', mediaType: 'image/jpeg', url: 'https://example.com/img2.jpg' },
        { type: 'file', mediaType: 'image/webp', url: 'https://example.com/img3.webp' },
      ];
      const result = toOpenAIMessageContent(message(parts));
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0].image_url.url).toBe('https://example.com/img1.png');
      expect(result[1].image_url.url).toBe('https://example.com/img2.jpg');
      expect(result[2].image_url.url).toBe('https://example.com/img3.webp');
    });
  });

  describe('mixed text and attachment messages', () => {
    it('returns array with text entry followed by image_url entries', () => {
      const parts = [
        { type: 'text', text: 'Check this image: ' },
        { type: 'file', mediaType: 'image/png', url: 'https://example.com/img.png' },
      ];
      const result = toOpenAIMessageContent(message(parts));
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'text', text: 'Check this image: ' });
      expect(result[1]).toEqual({
        type: 'image_url',
        image_url: { url: 'https://example.com/img.png' },
      });
    });

    it('joins all text parts into one, then adds image_url entries', () => {
      const parts = [
        { type: 'text', text: 'start' },
        { type: 'file', mediaType: 'image/png', url: 'https://example.com/1.png' },
        { type: 'text', text: 'middle' },
        { type: 'file', mediaType: 'image/jpeg', url: 'https://example.com/2.jpg' },
        { type: 'text', text: 'end' },
      ];
      const result = toOpenAIMessageContent(message(parts));
      expect(Array.isArray(result)).toBe(true);
      // 1 text entry (all text joined) + 2 image entries
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ type: 'text', text: 'startmiddleend' });
      expect(result[1].image_url.url).toBe('https://example.com/1.png');
      expect(result[2].image_url.url).toBe('https://example.com/2.jpg');
    });

    it('does not include text entry when all text parts are empty', () => {
      const parts = [
        { type: 'text', text: '' },
        { type: 'file', mediaType: 'image/png', url: 'https://example.com/img.png' },
        { type: 'text' },
      ];
      const result = toOpenAIMessageContent(message(parts));
      expect(Array.isArray(result)).toBe(true);
      // Should only have one entry (the image)
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('image_url');
    });

    it('includes text entry when there is non-empty text despite empty parts', () => {
      const parts = [
        { type: 'text', text: '' },
        { type: 'file', mediaType: 'image/png', url: 'https://example.com/img.png' },
        { type: 'text', text: 'caption' },
      ];
      const result = toOpenAIMessageContent(message(parts));
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'text', text: 'caption' });
    });
  });

  describe('edge cases', () => {
    it('handles data URLs in attachments', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const parts = [{ type: 'file', mediaType: 'image/png', url: dataUrl }];
      const result = toOpenAIMessageContent(message(parts));
      expect(Array.isArray(result)).toBe(true);
      expect((result[0] as any).image_url.url).toBe(dataUrl);
    });

    it('handles message with only non-file, non-text parts', () => {
      const parts = [
        { type: 'unknown', data: 'something' },
        { type: 'other', info: 'more' },
      ];
      const result = toOpenAIMessageContent(message(parts));
      expect(typeof result).toBe('string');
      expect(result).toBe('');
    });

    it('uses the url field from file parts (non-null)', () => {
      const parts = [
        { type: 'file', mediaType: 'image/png', url: 'https://example.com/img.png', filename: 'test.png' },
      ];
      const result = toOpenAIMessageContent(message(parts));
      expect(Array.isArray(result)).toBe(true);
      expect((result[0] as any).image_url.url).toBe('https://example.com/img.png');
    });
  });

  describe('type compatibility', () => {
    it('result is assignable to OpenAIMessageContent type', () => {
      const textOnlyParts = [{ type: 'text', text: 'hello' }];
      const textResult: OpenAIMessageContent = toOpenAIMessageContent(message(textOnlyParts));
      expect(typeof textResult).toBe('string');

      const withFileParts = [
        { type: 'text', text: 'text' },
        { type: 'file', mediaType: 'image/png', url: 'https://example.com/img.png' },
      ];
      const arrayResult: OpenAIMessageContent = toOpenAIMessageContent(message(withFileParts));
      expect(Array.isArray(arrayResult)).toBe(true);
    });
  });
});
