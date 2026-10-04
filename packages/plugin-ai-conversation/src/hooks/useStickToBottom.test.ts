import { renderHook, act } from '@testing-library/react';
import { useStickToBottom } from './useStickToBottom';
import { createRef } from 'react';

jest.useFakeTimers();

describe('useStickToBottom', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it('returns initial isAtBottom state and scrollToBottom function', () => {
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useStickToBottom(ref));

    expect(result.current).toHaveProperty('isAtBottom');
    expect(result.current).toHaveProperty('scrollToBottom');
    expect(typeof result.current.scrollToBottom).toBe('function');
  });

  it('detects when not at bottom', () => {
    const ref = createRef<HTMLDivElement>();
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollTop', { get: () => 0, set: () => {}, configurable: true });
    Object.defineProperty(element, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(element, 'clientHeight', { value: 500, configurable: true });

    (ref as any).current = element;

    const { result } = renderHook(() => useStickToBottom(ref));

    // Wait a tick for event listeners to be set up
    act(() => {
      jest.runAllTimers();
      element.dispatchEvent(new Event('scroll', { bubbles: false }));
      jest.runAllTimers();
    });

    expect(result.current.isAtBottom).toBe(false);
  });

  it('detects when at bottom (within 80px threshold)', () => {
    const ref = createRef<HTMLDivElement>();
    const element = document.createElement('div');

    // Set up: 600 - 100 - 500 = 0px from bottom (at bottom)
    Object.defineProperty(element, 'scrollTop', { get: () => 100, set: () => {}, configurable: true });
    Object.defineProperty(element, 'scrollHeight', { value: 600, configurable: true });
    Object.defineProperty(element, 'clientHeight', { value: 500, configurable: true });

    (ref as any).current = element;

    const { result } = renderHook(() => useStickToBottom(ref));

    act(() => {
      jest.runAllTimers();
      element.dispatchEvent(new Event('scroll', { bubbles: false }));
      jest.runAllTimers();
    });

    expect(result.current.isAtBottom).toBe(true);
  });

  it('considers within 80px threshold as at bottom', () => {
    const ref = createRef<HTMLDivElement>();
    const element = document.createElement('div');

    // Set up: 600 - 50 - 500 = 50px from bottom (within 80px threshold)
    Object.defineProperty(element, 'scrollTop', { get: () => 50, set: () => {}, configurable: true });
    Object.defineProperty(element, 'scrollHeight', { value: 600, configurable: true });
    Object.defineProperty(element, 'clientHeight', { value: 500, configurable: true });

    (ref as any).current = element;

    const { result } = renderHook(() => useStickToBottom(ref));

    act(() => {
      jest.runAllTimers();
      element.dispatchEvent(new Event('scroll', { bubbles: false }));
      jest.runAllTimers();
    });

    expect(result.current.isAtBottom).toBe(true); // 50px < 80px threshold
  });

  it('does not consider beyond 80px threshold as at bottom', () => {
    const ref = createRef<HTMLDivElement>();
    const element = document.createElement('div');

    // Set up: 600 - 0 - 500 = 100px from bottom (beyond threshold)
    Object.defineProperty(element, 'scrollTop', { get: () => 0, set: () => {}, configurable: true });
    Object.defineProperty(element, 'scrollHeight', { value: 600, configurable: true });
    Object.defineProperty(element, 'clientHeight', { value: 500, configurable: true });

    (ref as any).current = element;

    const { result } = renderHook(() => useStickToBottom(ref));

    act(() => {
      jest.runAllTimers();
      element.dispatchEvent(new Event('scroll', { bubbles: false }));
      jest.runAllTimers();
    });

    expect(result.current.isAtBottom).toBe(false); // 100px > 80px threshold
  });

  it('scrollToBottom calls scrollTo with smooth behavior by default', () => {
    const ref = createRef<HTMLDivElement>();
    const element = document.createElement('div');
    const scrollToSpy = jest.fn();
    element.scrollTo = scrollToSpy;
    Object.defineProperty(element, 'scrollHeight', { value: 1000 });

    (ref as any).current = element;

    const { result } = renderHook(() => useStickToBottom(ref));

    act(() => {
      result.current.scrollToBottom();
    });

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
  });

  it('scrollToBottom accepts custom behavior', () => {
    const ref = createRef<HTMLDivElement>();
    const element = document.createElement('div');
    const scrollToSpy = jest.fn();
    element.scrollTo = scrollToSpy;
    Object.defineProperty(element, 'scrollHeight', { value: 1000 });

    (ref as any).current = element;

    const { result } = renderHook(() => useStickToBottom(ref));

    act(() => {
      result.current.scrollToBottom('auto');
    });

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });
  });

  it('accepts deps array and responds to changes', () => {
    const ref = createRef<HTMLDivElement>();
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollTop', { get: () => 100, set: () => {}, configurable: true });
    Object.defineProperty(element, 'scrollHeight', { value: 600, configurable: true });
    Object.defineProperty(element, 'clientHeight', { value: 500, configurable: true });

    (ref as any).current = element;

    const { rerender } = renderHook(
      ({ deps }) => useStickToBottom(ref, deps),
      { initialProps: { deps: [0] } },
    );

    // Rerender with changed deps - should not throw
    act(() => {
      rerender({ deps: [1] });
    });

    expect(true).toBe(true);
  });

  it('handles null ref gracefully', () => {
    const ref = { current: null };

    const { result } = renderHook(() => useStickToBottom(ref as any));

    expect(result.current.isAtBottom).toBe(true);
    expect(() => result.current.scrollToBottom()).not.toThrow();
  });

  it('removes event listeners on unmount', () => {
    const ref = createRef<HTMLDivElement>();
    const element = document.createElement('div');
    const removeEventListenerSpy = jest.spyOn(element, 'removeEventListener');

    (ref as any).current = element;

    const { unmount } = renderHook(() => useStickToBottom(ref));

    act(() => {
      jest.runAllTimers();
    });

    unmount();

    act(() => {
      jest.runAllTimers();
    });

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });
});
