import { extractText } from '../hooks/messageShape';
import type { Thread } from '../types';

/**
 * Check if a thread matches a search query.
 * Searches both title and message content (case-insensitive).
 */
export function threadMatchesQuery(thread: Thread, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (thread.title.toLowerCase().includes(q)) return true;
  return thread.messages.some(m => extractText(m).toLowerCase().includes(q));
}

export type ThreadGroupKey = 'pinned' | 'today' | 'yesterday' | 'week' | 'month' | 'older';

export interface ThreadGroup {
  key: ThreadGroupKey;
  label: string;
  threads: Thread[];
}

/**
 * Group threads by date (with pinned first).
 * Uses local calendar days to determine grouping.
 *
 * @param threads - Array of threads to group
 * @param now - Current timestamp in ms (defaults to Date.now())
 * @returns Array of groups, sorted in display order, empty groups omitted
 */
export function groupThreadsByDate(threads: Thread[], now = Date.now()): ThreadGroup[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const yesterday = new Date(todayMs);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayMs = yesterday.getTime();

  const weekAgo = new Date(todayMs);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoMs = weekAgo.getTime();

  const monthAgo = new Date(todayMs);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthAgoMs = monthAgo.getTime();

  const groups: Record<ThreadGroupKey, Thread[]> = {
    pinned: [],
    today: [],
    yesterday: [],
    week: [],
    month: [],
    older: [],
  };

  for (const thread of threads) {
    if (thread.pinned) {
      groups.pinned.push(thread);
    } else {
      const threadDate = new Date(thread.updatedAt);
      threadDate.setHours(0, 0, 0, 0);
      const threadDateMs = threadDate.getTime();

      if (threadDateMs === todayMs) {
        groups.today.push(thread);
      } else if (threadDateMs === yesterdayMs) {
        groups.yesterday.push(thread);
      } else if (threadDateMs > weekAgoMs) {
        groups.week.push(thread);
      } else if (threadDateMs > monthAgoMs) {
        groups.month.push(thread);
      } else {
        groups.older.push(thread);
      }
    }
  }

  // Sort each group by updatedAt descending (most recent first)
  const sortByDate = (a: Thread, b: Thread) => b.updatedAt - a.updatedAt;
  Object.values(groups).forEach(g => g.sort(sortByDate));

  // Build result array in order, omitting empty groups
  const result: ThreadGroup[] = [];
  const order: ThreadGroupKey[] = ['pinned', 'today', 'yesterday', 'week', 'month', 'older'];
  const labels: Record<ThreadGroupKey, string> = {
    pinned: 'Pinned',
    today: 'Today',
    yesterday: 'Yesterday',
    week: 'Previous 7 days',
    month: 'Previous 30 days',
    older: 'Older',
  };

  for (const key of order) {
    if (groups[key].length > 0) {
      result.push({ key, label: labels[key], threads: groups[key] });
    }
  }

  return result;
}
