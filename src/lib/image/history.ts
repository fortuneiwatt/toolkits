/** Generic undo/redo state. Pure functions so they work with useReducer and are easy to test. */
export interface HistoryState<T> { past: T[]; present: T; future: T[] }

export interface HistoryOptions<T> {
  /** Maximum number of undo steps kept. */
  limit: number;
  /**
   * Memory guard. Returns the heavy resource an entry holds (identity + cost). Entries sharing the same
   * resource are only counted once, so annotation-only edits on a big image stay cheap.
   */
  resource?: (entry: T) => { id: object; cost: number };
  /** Maximum total cost of distinct resources kept across the whole history. */
  budget?: number;
}

export const createHistory = <T,>(initial: T): HistoryState<T> => ({ past: [], present: initial, future: [] });
export const canUndo = (h: HistoryState<unknown>) => h.past.length > 0;
export const canRedo = (h: HistoryState<unknown>) => h.future.length > 0;

function trim<T>(past: T[], present: T, future: T[], opts: HistoryOptions<T>): T[] {
  let kept = past.length > opts.limit ? past.slice(past.length - opts.limit) : past;
  if (opts.resource && opts.budget) {
    const total = (list: T[]) => {
      const seen = new Map<object, number>();
      for (const e of [...list, present, ...future]) {
        const r = opts.resource!(e);
        seen.set(r.id, r.cost);
      }
      let sum = 0;
      seen.forEach((c) => (sum += c));
      return sum;
    };
    while (kept.length > 1 && total(kept) > opts.budget) kept = kept.slice(1);
  }
  return kept;
}

export function pushState<T>(h: HistoryState<T>, next: T, opts: HistoryOptions<T>): HistoryState<T> {
  if (next === h.present) return h;
  return { past: trim([...h.past, h.present], next, [], opts), present: next, future: [] };
}

export function undoState<T>(h: HistoryState<T>): HistoryState<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redoState<T>(h: HistoryState<T>): HistoryState<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
