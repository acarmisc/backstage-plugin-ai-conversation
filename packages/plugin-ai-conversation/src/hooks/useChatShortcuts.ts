import { useEffect, useRef } from 'react';

export interface ChatShortcutHandlers {
  onNewChat?: () => void;
  onFocusComposer?: () => void;
  onStop?: () => void;
  onToggleSidebar?: () => void;
  onSearch?: () => void;
}

export interface ShortcutInfo {
  keys: string[];
  description: string;
}

/**
 * List of all available keyboard shortcuts for display in help/settings.
 * Uses cross-platform notation ('⌘/Ctrl' for Mac vs Windows).
 */
export const SHORTCUTS: ShortcutInfo[] = [
  {
    keys: ['⌘/Ctrl', 'Shift', 'O'],
    description: 'New chat',
  },
  {
    keys: ['⌘/Ctrl', 'K'],
    description: 'Search threads',
  },
  {
    keys: ['⌘/Ctrl', 'B'],
    description: 'Toggle sidebar',
  },
  {
    keys: ['Escape'],
    description: 'Stop generation',
  },
  {
    keys: ['/'],
    description: 'Focus composer (when not in input)',
  },
];

/**
 * Global keyboard shortcut listener for common chat actions.
 *
 * Shortcuts:
 * - Ctrl/Cmd+Shift+O: New chat
 * - Ctrl/Cmd+K: Search threads
 * - Ctrl/Cmd+B: Toggle sidebar
 * - Escape: Stop generation (only if handler provided)
 * - '/': Focus composer (only when focus is not already in an input/textarea/contenteditable)
 *
 * Prevents default behavior when shortcuts are handled.
 *
 * @param handlers - Callback functions for each shortcut
 */
export function useChatShortcuts(handlers: ChatShortcutHandlers): void {
  // Read the latest handlers from a ref so the listener is attached once,
  // not on every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = handlersRef.current;
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      // Check if focus is in a text input (shouldn't intercept composer input)
      const focusedElement = document.activeElement;
      const isInTextInput =
        focusedElement instanceof HTMLInputElement ||
        focusedElement instanceof HTMLTextAreaElement ||
        (focusedElement instanceof HTMLElement &&
          (focusedElement.isContentEditable ||
            !!focusedElement.closest('[contenteditable=""],[contenteditable="true"]')));

      // Ctrl/Cmd+Shift+O: New chat
      if (modKey && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        current.onNewChat?.();
        return;
      }

      // Ctrl/Cmd+K: Search threads
      if (modKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        current.onSearch?.();
        return;
      }

      // Ctrl/Cmd+B: Toggle sidebar
      if (modKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        current.onToggleSidebar?.();
        return;
      }

      // Escape: Stop generation
      // Only while there is something to stop, so Escape keeps closing
      // menus and dialogs otherwise.
      if (event.key === 'Escape' && current.onStop) {
        event.preventDefault();
        current.onStop();
        return;
      }

      // '/': Focus composer (only when not already in a text input)
      if (event.key === '/' && !isInTextInput) {
        event.preventDefault();
        current.onFocusComposer?.();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
