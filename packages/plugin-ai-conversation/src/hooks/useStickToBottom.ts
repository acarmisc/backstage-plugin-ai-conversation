import { useEffect, useRef, useCallback, useState } from 'react';

export interface UseStickToBottomResult {
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

/**
 * Hook for automatic scroll-to-bottom behavior.
 *
 * Tracks whether the scroll container is within 80px of the bottom.
 * When dependencies change, automatically scrolls to bottom ONLY if the user
 * was already at the bottom, so reading history while streaming doesn't
 * yank the view downward.
 *
 * @param scrollRef - Ref to the scrollable element
 * @param deps - Dependency array; when these change, auto-scroll triggers if at bottom
 * @returns Object with current isAtBottom state and a scrollToBottom function
 */
export function useStickToBottom(scrollRef: React.RefObject<HTMLElement>, deps: unknown[] = []): UseStickToBottomResult {
  // Start "at bottom": a fresh or short conversation has nothing to scroll,
  // so it must follow new content until the user scrolls up.
  // Start "at bottom": a fresh or short conversation has nothing to scroll,
  // so it must follow new content until the user scrolls up.
  const [isAtBottom, setIsAtBottom] = useState(true);
  const wasAtBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    // scrollTo is missing in jsdom and some embedded webviews.
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [scrollRef]);

  // Check if currently at bottom (within 80px)
  const checkIsAtBottom = useCallback((): boolean => {
    if (!scrollRef.current) {
      setIsAtBottom(false);
      return false;
    }
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 80;
    setIsAtBottom(atBottom);
    return atBottom;
  }, [scrollRef]);

  // Listen to scroll events
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    const handleScroll = (): void => {
      const atBottom = checkIsAtBottom();
      wasAtBottomRef.current = atBottom;
    };

    // Use requestAnimationFrame to avoid excessive handler calls
    let rafId: number | null = null;
    const throttledScroll = (): void => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        handleScroll();
        rafId = null;
      });
    };

    element.addEventListener('scroll', throttledScroll, { passive: true });
    return (): void => {
      element.removeEventListener('scroll', throttledScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [scrollRef, checkIsAtBottom]);

  // Auto-scroll when deps change, only if we were at bottom
  useEffect(() => {
    if (wasAtBottomRef.current) {
      // Use requestAnimationFrame to ensure DOM has settled
      const rafId = requestAnimationFrame(() => {
        scrollToBottom('auto');
      });
      return (): void => {
        cancelAnimationFrame(rafId);
      };
    }
    return undefined;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { isAtBottom, scrollToBottom };
}
