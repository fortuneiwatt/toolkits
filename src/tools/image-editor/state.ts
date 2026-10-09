import { createHistory, pushState, redoState, undoState, type HistoryOptions, type HistoryState } from "@/lib/image/history";
import { defaultAdjustments } from "@/lib/image/effects";
import type { DocState } from "./types";

export interface EditorState {
  history: HistoryState<DocState> | null;
  /** The image as first loaded, so Reset can return to it. */
  original: DocState | null;
}

export type EditorAction =
  | { type: "load"; base: HTMLCanvasElement }
  | { type: "commit"; doc: DocState | null }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" }
  | { type: "close" };

/** Keep at most 30 steps and roughly 80 million distinct pixels of rasters in memory (~320 MB worst case). */
export const historyOptions: HistoryOptions<DocState> = {
  limit: 30,
  resource: (d) => ({ id: d.base, cost: d.base.width * d.base.height }),
  budget: 80_000_000,
};

export const initialEditorState: EditorState = { history: null, original: null };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "load": {
      const doc: DocState = { base: action.base, shapes: [], adjustments: { ...defaultAdjustments } };
      return { history: createHistory(doc), original: doc };
    }
    case "commit":
      return state.history && action.doc ? { ...state, history: pushState(state.history, action.doc, historyOptions) } : state;
    case "undo":
      return state.history ? { ...state, history: undoState(state.history) } : state;
    case "redo":
      return state.history ? { ...state, history: redoState(state.history) } : state;
    case "reset":
      // Reset is itself an undoable step, so it can never destroy work by accident.
      return state.history && state.original ? { ...state, history: pushState(state.history, { ...state.original }, historyOptions) } : state;
    case "close":
      return initialEditorState;
  }
}
