import { useCallback, useEffect, useRef, useState } from 'react';

export interface ResizablePanelOptions {
  /** localStorage key the chosen width is persisted under. */
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /**
   * Which edge the drag handle sits on. For a right-hand sidebar the handle is
   * on its `left` edge, so dragging left (negative delta) grows the panel.
   */
  side: 'left' | 'right';
}

export interface ResizablePanel {
  width: number;
  /** Attach to the drag handle element. */
  onPointerDown: (e: React.PointerEvent) => void;
  /** Snap back to `defaultWidth` — wire to the handle's onDoubleClick. */
  reset: () => void;
}

function readStoredWidth(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === 'undefined') return fallback;
  const stored = Number(window.localStorage.getItem(key));
  return Number.isFinite(stored) && stored >= min && stored <= max ? stored : fallback;
}

/**
 * Pointer-driven width control for a flex sidebar, persisted across reloads.
 * The handle is a sibling element; movement is tracked on `window` so the drag
 * survives the pointer leaving the thin handle strip.
 */
export function useResizablePanel({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  side,
}: ResizablePanelOptions): ResizablePanel {
  const [width, setWidth] = useState(() =>
    readStoredWidth(storageKey, defaultWidth, minWidth, maxWidth),
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, String(Math.round(width)));
    }
  }, [storageKey, width]);

  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      const startX = e.clientX;
      const startWidth = width;

      const onMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - startX;
        const next = side === 'left' ? startWidth - delta : startWidth + delta;
        setWidth(Math.min(maxWidth, Math.max(minWidth, next)));
      };
      const onUp = () => {
        dragging.current = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width, minWidth, maxWidth, side],
  );

  const reset = useCallback(() => setWidth(defaultWidth), [defaultWidth]);

  return { width, onPointerDown, reset };
}
