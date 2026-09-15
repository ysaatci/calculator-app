import { useReducer, useRef } from "react";
import {
  calculate,
  CalculatorApiError,
  type BinaryOperation,
  type CalculateResult,
  type UnaryOperation,
} from "../api/calculatorApi";
import {
  currentOperand,
  displayText,
  initialState,
  reducer,
  type Action,
} from "./machine";

/**
 * Wires the state machine to the API. The machine stays pure and the
 * component stays presentational; everything that needs I/O or timing -
 * requests, cancellation, error mapping - lives here.
 */
export function useCalculator() {
  const [state, dispatch] = useReducer(reducer, initialState);
  // One controller per in-flight request. Aborting it both cancels the HTTP
  // call and marks its reply as unwanted, so a superseded answer can't
  // overwrite the display.
  const inFlight = useRef<AbortController | null>(null);

  async function run(
    request: (signal: AbortSignal) => Promise<CalculateResult>,
    resultAction: (result: number) => Action,
  ) {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    dispatch({ type: "calculationStarted" });

    try {
      const { result } = await request(controller.signal);
      if (!controller.signal.aborted) {
        dispatch(resultAction(result));
      }
    } catch (err) {
      if (controller.signal.aborted) {
        return; // Cancelled deliberately; the state has already moved on.
      }
      dispatch({
        type: "calculationFailed",
        message: err instanceof CalculatorApiError ? err.message : "Unexpected error",
      });
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
      }
    }
  }

  function inputDigit(digit: string) {
    dispatch({ type: "digitPressed", digit });
  }

  function inputDecimal() {
    dispatch({ type: "decimalPressed" });
  }

  /**
   * Clear is the one key that works mid-request, so a slow or dead backend
   * can never leave the user with an unusable keypad.
   */
  function clear() {
    inFlight.current?.abort();
    dispatch({ type: "cleared" });
  }

  async function chooseOperation(operation: BinaryOperation) {
    if (state.view.kind === "busy") {
      return;
    }
    if (state.view.kind === "error") {
      dispatch({ type: "operationPending", operation, operand: 0 });
      return;
    }

    const operand = Number(state.view.display);
    const { pending } = state;

    // A second operator with a fresh operand typed in between means the
    // first calculation is due now: 2 + 3 × resolves 2 + 3 before chaining.
    if (pending && !state.view.overwrite) {
      await run(
        (signal) =>
          calculate({ operation: pending.operation, a: pending.operand, b: operand, signal }),
        (result) => ({ type: "resultChained", result, operation }),
      );
      return;
    }

    dispatch({ type: "operationPending", operation, operand });
  }

  async function applyUnaryOperation(operation: UnaryOperation) {
    if (state.view.kind === "busy") {
      return;
    }
    if (state.view.kind === "error") {
      dispatch({ type: "cleared" });
      return;
    }

    const a = Number(state.view.display);
    await run(
      (signal) => calculate({ operation, a, signal }),
      (result) => ({ type: "unaryResultShown", result }),
    );
  }

  async function equals() {
    if (state.view.kind !== "value" || state.pending === null) {
      return;
    }

    const { pending } = state;
    const b = Number(state.view.display);
    await run(
      (signal) => calculate({ operation: pending.operation, a: pending.operand, b, signal }),
      (result) => ({ type: "resultShown", result }),
    );
  }

  return {
    display: displayText(state),
    pendingOperation: state.pending?.operation ?? null,
    error: state.view.kind === "error" ? state.view.message : null,
    busy: state.view.kind === "busy",
    operand: currentOperand(state),
    inputDigit,
    inputDecimal,
    clear,
    chooseOperation,
    applyUnaryOperation,
    equals,
  };
}
