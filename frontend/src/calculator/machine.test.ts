import { describe, expect, it } from "vitest";
import {
  displayText,
  initialState,
  reducer,
  type Action,
  type State,
} from "./machine";

/** Applies a sequence of actions, the way a run of key presses would. */
function run(...actions: Action[]): State {
  return actions.reduce(reducer, initialState);
}

describe("digit entry", () => {
  it("replaces the leading zero rather than appending to it", () => {
    const state = run({ type: "digitPressed", digit: "7" });
    expect(displayText(state)).toBe("7");
  });

  it("appends further digits", () => {
    const state = run(
      { type: "digitPressed", digit: "1" },
      { type: "digitPressed", digit: "2" },
      { type: "digitPressed", digit: "3" },
    );
    expect(displayText(state)).toBe("123");
  });

  it("allows only one decimal point per number", () => {
    const state = run(
      { type: "digitPressed", digit: "1" },
      { type: "decimalPressed" },
      { type: "digitPressed", digit: "2" },
      { type: "decimalPressed" },
      { type: "digitPressed", digit: "5" },
    );
    expect(displayText(state)).toBe("1.25");
  });

  it("starts a decimal with a leading zero", () => {
    expect(displayText(run({ type: "decimalPressed" }))).toBe("0.");
  });

  it("starts a new number after a result instead of extending it", () => {
    const state = run({ type: "resultShown", result: 12 }, { type: "digitPressed", digit: "5" });
    expect(displayText(state)).toBe("5");
  });
});

describe("pending operations", () => {
  it("holds the operation together with its operand", () => {
    const state = run(
      { type: "digitPressed", digit: "5" },
      { type: "operationPending", operation: "add", operand: 5 },
    );
    expect(state.pending).toEqual({ operation: "add", operand: 5 });
  });

  it("clears the pending operation once the result is shown", () => {
    const state = run(
      { type: "operationPending", operation: "add", operand: 5 },
      { type: "calculationStarted" },
      { type: "resultShown", result: 8 },
    );
    expect(state.pending).toBeNull();
    expect(displayText(state)).toBe("8");
  });

  it("feeds a chained result into the next operation", () => {
    const state = run(
      { type: "operationPending", operation: "add", operand: 2 },
      { type: "calculationStarted" },
      { type: "resultChained", result: 5, operation: "multiply" },
    );
    expect(state.pending).toEqual({ operation: "multiply", operand: 5 });
    expect(displayText(state)).toBe("5");
  });

  // The invariant a comment used to carry: a unary key must not disturb a
  // half-built binary calculation, or 5 + 9 √ = stops meaning 5 + 3.
  it("leaves a pending operation untouched when a unary result lands", () => {
    const state = run(
      { type: "operationPending", operation: "add", operand: 5 },
      { type: "calculationStarted" },
      { type: "unaryResultShown", result: 3 },
    );
    expect(state.pending).toEqual({ operation: "add", operand: 5 });
    expect(displayText(state)).toBe("3");
  });
});

// What the next operator does depends on how the displayed value came to be,
// so each way of arriving at a value has to record it distinctly.
describe("entry", () => {
  const entryOf = (state: State) => (state.view.kind === "value" ? state.view.entry : null);

  it("is typing while digits are entered", () => {
    expect(entryOf(run({ type: "digitPressed", digit: "4" }))).toBe("typing");
  });

  it("is awaiting once an operator has taken the value as its operand", () => {
    const state = run(
      { type: "digitPressed", digit: "5" },
      { type: "operationPending", operation: "add", operand: 5 },
    );
    expect(entryOf(state)).toBe("awaiting");
  });

  it("is awaiting after a chained result, which is the next operation's operand", () => {
    const state = run(
      { type: "operationPending", operation: "add", operand: 2 },
      { type: "calculationStarted" },
      { type: "resultChained", result: 5, operation: "multiply" },
    );
    expect(entryOf(state)).toBe("awaiting");
  });

  it("is computed after a unary result, which is an operand in its own right", () => {
    const state = run(
      { type: "operationPending", operation: "add", operand: 5 },
      { type: "calculationStarted" },
      { type: "unaryResultShown", result: 3 },
    );
    expect(entryOf(state)).toBe("computed");
  });

  it("is computed after equals", () => {
    expect(entryOf(run({ type: "resultShown", result: 8 }))).toBe("computed");
  });

  it.each(["awaiting", "computed"] as const)(
    "starts a new number when a digit follows %s",
    (entry) => {
      const state: State = { view: { kind: "value", display: "5", entry }, pending: null };
      expect(displayText(reducer(state, { type: "digitPressed", digit: "7" }))).toBe("7");
    },
  );
});

describe("in-flight calculations", () => {
  it("shows a placeholder rather than a stale value", () => {
    const state = run({ type: "digitPressed", digit: "9" }, { type: "calculationStarted" });
    expect(displayText(state)).toBe("…");
  });

  it("ignores key presses that arrive mid-request", () => {
    const busy = run({ type: "digitPressed", digit: "9" }, { type: "calculationStarted" });

    expect(reducer(busy, { type: "digitPressed", digit: "4" })).toBe(busy);
    expect(reducer(busy, { type: "decimalPressed" })).toBe(busy);
    expect(reducer(busy, { type: "operationPending", operation: "add", operand: 1 })).toBe(busy);
  });

  it("can always be cleared", () => {
    const busy = run({ type: "digitPressed", digit: "9" }, { type: "calculationStarted" });
    expect(reducer(busy, { type: "cleared" })).toEqual(initialState);
  });
});

describe("errors", () => {
  const failed = run({ type: "calculationFailed", message: "division by zero" });

  it("shows the error placeholder and keeps the message", () => {
    expect(displayText(failed)).toBe("Error");
    expect(failed.view).toEqual({ kind: "error", message: "division by zero" });
  });

  it("drops any pending operation", () => {
    const state = run(
      { type: "operationPending", operation: "divide", operand: 1 },
      { type: "calculationStarted" },
      { type: "calculationFailed", message: "division by zero" },
    );
    expect(state.pending).toBeNull();
  });

  it("starts a fresh number when a digit follows", () => {
    const state = reducer(failed, { type: "digitPressed", digit: "7" });
    expect(displayText(state)).toBe("7");
    expect(state.view.kind).toBe("value");
  });

  it("starts from zero when an operation follows", () => {
    const state = reducer(failed, { type: "operationPending", operation: "add", operand: 0 });
    expect(displayText(state)).toBe("0");
    expect(state.pending).toEqual({ operation: "add", operand: 0 });
  });

  it("is cleared outright by C", () => {
    expect(reducer(failed, { type: "cleared" })).toEqual(initialState);
  });
});

describe("results", () => {
  it("hides floating point artefacts", () => {
    // What the backend really returns for 0.1 + 0.2.
    const state = run({ type: "resultShown", result: 0.30000000000000004 });
    expect(displayText(state)).toBe("0.3");
  });
});
