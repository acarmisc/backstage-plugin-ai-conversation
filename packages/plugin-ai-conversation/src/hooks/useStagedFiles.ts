import { useCallback, useRef, useState } from 'react';
import type { FileUIPart } from 'ai';

/** Mirrors the backend's attachments.ts limits. The two packages don't share
 * a types module, so these are kept in sync by hand — a mismatch only means
 * the user sees a later 400 instead of an earlier client-side warning. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 4;
export const ALLOWED_ATTACHMENT_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
/** The backend caps the base64 data URL at 6,000,000 characters; base64
 * inflates by 4/3, so this is the largest file that stays under it. */
export const MAX_ATTACHMENT_BYTES = 4_400_000;

export interface StagedFiles {
  files: FileUIPart[];
  error: string | null;
  /** Accepts a `FileList` or a plain array: callers that reset an
   * `<input type="file">` must copy its live `FileList` first. */
  add: (list: FileList | File[]) => Promise<void>;
  remove: (index: number) => void;
  clear: () => void;
  dismissError: () => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Splits picked files into the ones the backend will accept and a
 * user-facing reason for the first one it won't. */
export function partitionAttachments(
  files: File[],
  alreadyStaged: number,
): { accepted: File[]; error: string | null } {
  const accepted: File[] = [];
  let error: string | null = null;
  for (const file of files) {
    if (!ALLOWED_ATTACHMENT_MEDIA_TYPES.includes(file.type)) {
      error ??= `${file.name || 'This file'} can't be attached: only PNG, JPEG, WebP and GIF images are supported`;
    } else if (file.size > MAX_ATTACHMENT_BYTES) {
      error ??= `${file.name || 'This image'} is too large (max 4 MB)`;
    } else if (alreadyStaged + accepted.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
      error ??= `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} images per message`;
    } else {
      accepted.push(file);
    }
  }
  return { accepted, error };
}

/**
 * Stages image attachments for the next send. Files are converted to
 * data-URL `FileUIPart`s up front so the composer can show them and
 * `sendMessage` can forward them directly.
 */
export function useStagedFiles(): StagedFiles {
  const [files, setFiles] = useState<FileUIPart[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Paste and drop can add twice before a re-render; the count limit has to
  // see both.
  const countRef = useRef(0);

  const add = useCallback(async (list: FileList | File[]) => {
    const { accepted, error: rejection } = partitionAttachments(
      Array.from(list),
      countRef.current,
    );
    setError(rejection);
    if (!accepted.length) return;
    countRef.current += accepted.length;
    let parts: FileUIPart[];
    try {
      parts = await Promise.all(
        accepted.map(async file => ({
          type: 'file' as const,
          mediaType: file.type,
          filename: file.name || undefined,
          url: await readAsDataUrl(file),
        })),
      );
    } catch {
      countRef.current -= accepted.length;
      setError('Failed to read the attached file');
      return;
    }
    setFiles(prev => [...prev, ...parts]);
  }, []);

  const remove = useCallback((index: number) => {
    setFiles(prev => {
      const next = prev.filter((_, i) => i !== index);
      countRef.current = next.length;
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    countRef.current = 0;
    setFiles([]);
  }, []);
  const dismissError = useCallback(() => setError(null), []);

  return { files, error, add, remove, clear, dismissError };
}
