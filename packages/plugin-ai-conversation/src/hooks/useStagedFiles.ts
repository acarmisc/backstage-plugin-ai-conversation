import { useCallback, useState } from 'react';
import { convertFileListToFileUIParts } from 'ai';
import type { FileUIPart } from 'ai';

/** Mirrors the backend's attachments.ts limits. The two packages don't share
 * a types module, so these are kept in sync by hand — a mismatch only means
 * the user sees a later 400 instead of an earlier client-side warning. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 4;

export interface StagedFiles {
  files: FileUIPart[];
  error: string | null;
  add: (list: FileList) => Promise<void>;
  remove: (index: number) => void;
  clear: () => void;
  dismissError: () => void;
}

/**
 * Stages image attachments for the next send. Files are converted to
 * data-URL `FileUIPart`s up front (the SDK's own converter) so the composer
 * can show them and `sendMessage` can forward them directly.
 */
export function useStagedFiles(): StagedFiles {
  const [files, setFiles] = useState<FileUIPart[]>([]);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(async (list: FileList) => {
    if (!list.length) return;
    let parts: FileUIPart[];
    try {
      parts = await convertFileListToFileUIParts(list);
    } catch {
      setError('Failed to read attached file');
      return;
    }
    // Compute the outcome before touching state — a state updater must stay
    // pure, so no setError call inside it.
    if (files.length + parts.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      setError(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} images per message`);
      return;
    }
    setError(null);
    setFiles([...files, ...parts]);
  }, [files]);

  const remove = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => setFiles([]), []);
  const dismissError = useCallback(() => setError(null), []);

  return { files, error, add, remove, clear, dismissError };
}
