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
/**
 * Pointer-driven width control for a flex sidebar, persisted across reloads.
 * The handle is a sibling element; movement is tracked on `window` so the drag
 * survives the pointer leaving the thin handle strip.
 */
export declare function useResizablePanel({ storageKey, defaultWidth, minWidth, maxWidth, side, }: ResizablePanelOptions): ResizablePanel;
