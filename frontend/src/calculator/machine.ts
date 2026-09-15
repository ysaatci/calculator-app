import type { BinaryOperation } from "../api/calculatorApi";
import { formatResult } from "../format";

/**
 * The calculator's input state, as a pure state machine.
 *
 * The shape is the point. An earlier version kept six loose fields - display,
 * storedValue, pendingOperation, overwrite, error, loading - whose legal
 * combinations were only implied: an error had to coincide with a display of
 * "Error", a pending operation had to coincide with a stored operand, and a
 * request in flight had to coincide with a display nobody should read. The
 * code defended against the combinations it couldn't rule out. Here a view is
 * exactly one of three things, and an operation can't exist apart from the
 * operand it is waiting on, so those states are unrepresentable rather than
 * guarded.
 */

/** A binary operation holding its first operand, waiting for the second. */
export interface Pending {
  operation: BinaryOperation;
  operand: number;
}

/**
 * How the displayed value came to be, which decides what the next key does.
 *
 * - `typing`   — digits the user is entering. The next digit appends.
 * - `awaiting` — the value is the pending operation's own first operand,
 *                shown while nothing has been typed for the second. The next
 *                digit starts that second operand; another operator just
 *                replaces the pending one (`5 + ×` means ×).
 * - `computed` — a result standing on its own. The next digit starts afresh,
 *                but an operator treats it as a genuine operand
 *                (`5 + 9 √ ×` resolves 5 + 3 before chaining).
 *
 * This used to be a single `overwrite` flag. `awaiting` and `computed` both
 * set it, since in both the next digit replaces the display, but they need
 * opposite answers when an operator comes next - and a boolean couldn't tell
 * them apart, so a unary result followed by an operator discarded the sum in
 * progress.
 */
export type Entry = "typing" | "awaiting" | "computed";

export type View =
  | { kind: "value"; display: string; entry: Entry }
  | { kind: "busy" }
  | { kind: "error"; message: string };

export interface State {
  view: View;
  pending: Pending | null;
}

export const initialState: State = {
  view: { kind: "value", display: "0", entry: "typing" },
  pending: null,
};

/**
 * Actions are named after what happened, not what to set. The three result
 * actions exist because a result means three different things depending on
 * the gesture that asked for it: finish the calculation, feed the next one,
 * or replace the operand of a calculation still being built.
 */
export type Action =
  | { type: "digitPressed"; digit: string }
  | { type: "decimalPressed" }
  | { type: "cleared" }
  | { type: "operationPending"; operation: BinaryOperation; operand: number }
  | { type: "calculationStarted" }
  | { type: "resultShown"; result: number }
  | { type: "resultChained"; result: number; operation: BinaryOperation }
  | { type: "unaryResultShown"; result: number }
  | { type: "calculationFailed"; message: string };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "digitPressed": {
      if (state.view.kind === "busy") {
        return state;
      }
      if (state.view.kind === "error") {
        return { view: showing(action.digit), pending: null };
      }
      const { display, entry } = state.view;
      if (entry !== "typing" || display === "0") {
        return { ...state, view: showing(action.digit) };
      }
      return { ...state, view: showing(display + action.digit) };
    }

    case "decimalPressed": {
      if (state.view.kind === "busy") {
        return state;
      }
      if (state.view.kind === "error") {
        return { view: showing("0."), pending: null };
      }
      const { display, entry } = state.view;
      if (entry !== "typing") {
        return { ...state, view: showing("0.") };
      }
      if (display.includes(".")) {
        return state;
      }
      return { ...state, view: showing(display + ".") };
    }

    case "cleared":
      return initialState;

    case "operationPending": {
      if (state.view.kind === "busy") {
        return state;
      }
      // Choosing an operation after an error starts a fresh sum from zero,
      // since "Error" is not an operand.
      const display = state.view.kind === "value" ? state.view.display : "0";
      return {
        view: { kind: "value", display, entry: "awaiting" },
        pending: { operation: action.operation, operand: action.operand },
      };
    }

    case "calculationStarted":
      return { ...state, view: { kind: "busy" } };

    case "resultShown":
      return { view: computed(action.result), pending: null };

    // The result has just become the new operation's first operand, so this
    // is the same situation as having pressed the operator: awaiting, not a
    // freestanding result. 2 + 3 × − therefore switches × to −.
    case "resultChained":
      return {
        view: { kind: "value", display: formatResult(action.result), entry: "awaiting" },
        pending: { operation: action.operation, operand: action.result },
      };

    // A unary key acts on the displayed value alone, so a half-built binary
    // calculation carries on untouched: 5 + 9 √ = still adds 5 to 3. The
    // result is a real operand for whatever comes next.
    case "unaryResultShown":
      return { ...state, view: computed(action.result) };

    case "calculationFailed":
      return { view: { kind: "error", message: action.message }, pending: null };
  }
}

/** The string the display should show for a given state. */
export function displayText(state: State): string {
  switch (state.view.kind) {
    case "busy":
      return "…";
    case "error":
      return "Error";
    case "value":
      return state.view.display;
  }
}

/** The operand the next calculation should use, or null if there isn't one. */
export function currentOperand(state: State): number | null {
  return state.view.kind === "value" ? Number(state.view.display) : null;
}

/** A value the user is still typing into. */
function showing(display: string): View {
  return { kind: "value", display, entry: "typing" };
}

/** A freestanding result, usable as an operand by whatever comes next. */
function computed(result: number): View {
  return { kind: "value", display: formatResult(result), entry: "computed" };
}
