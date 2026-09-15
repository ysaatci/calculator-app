import { useState } from "react";
import { calculate, CalculatorApiError, type Operation } from "../api/calculatorApi";
import "./Calculator.css";

const OPERATION_SYMBOLS: Record<Operation, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
};

interface State {
  display: string;
  storedValue: number | null;
  pendingOperation: Operation | null;
  overwrite: boolean;
  error: string | null;
  loading: boolean;
}

const INITIAL_STATE: State = {
  display: "0",
  storedValue: null,
  pendingOperation: null,
  overwrite: false,
  error: null,
  loading: false,
};

export function Calculator() {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const { display, pendingOperation, error, loading } = state;

  function inputDigit(digit: string) {
    setState((s) => {
      if (s.error) {
        return { ...INITIAL_STATE, display: digit === "0" ? "0" : digit };
      }
      if (s.overwrite) {
        return { ...s, display: digit, overwrite: false };
      }
      if (s.display === "0") {
        return { ...s, display: digit };
      }
      return { ...s, display: s.display + digit };
    });
  }

  function inputDecimal() {
    setState((s) => {
      if (s.error) {
        return { ...INITIAL_STATE, display: "0." };
      }
      if (s.overwrite) {
        return { ...s, display: "0.", overwrite: false };
      }
      if (s.display.includes(".")) {
        return s;
      }
      return { ...s, display: s.display + "." };
    });
  }

  function clear() {
    setState(INITIAL_STATE);
  }

  async function chooseOperation(operation: Operation) {
    if (state.error) {
      setState({ ...INITIAL_STATE, storedValue: Number(state.display) || 0, pendingOperation: operation, overwrite: true });
      return;
    }

    const currentValue = Number(state.display);

    if (state.pendingOperation !== null && !state.overwrite) {
      await runCalculation(state.pendingOperation, state.storedValue ?? 0, currentValue, operation);
      return;
    }

    setState((s) => ({
      ...s,
      storedValue: currentValue,
      pendingOperation: operation,
      overwrite: true,
    }));
  }

  async function equals() {
    if (state.pendingOperation === null || state.storedValue === null || state.error) {
      return;
    }
    await runCalculation(state.pendingOperation, state.storedValue, Number(state.display), null);
  }

  async function runCalculation(
    operation: Operation,
    a: number,
    b: number,
    nextPendingOperation: Operation | null,
  ) {
    setState((s) => ({ ...s, loading: true }));
    try {
      const { result } = await calculate(operation, a, b);
      setState({
        display: formatResult(result),
        storedValue: nextPendingOperation ? result : null,
        pendingOperation: nextPendingOperation,
        overwrite: true,
        error: null,
        loading: false,
      });
    } catch (err) {
      const message = err instanceof CalculatorApiError ? err.message : "Unexpected error";
      setState({
        display: "Error",
        storedValue: null,
        pendingOperation: null,
        overwrite: true,
        error: message,
        loading: false,
      });
    }
  }

  return (
    <div className="calculator" role="group" aria-label="Calculator">
      <div className="calculator-display" data-testid="display" aria-live="polite">
        <span className="calculator-display-value">
          {loading ? "…" : formatForDisplay(display)}
        </span>
        {pendingOperation && (
          <span className="calculator-display-operation">
            {OPERATION_SYMBOLS[pendingOperation]}
          </span>
        )}
      </div>
      {error && (
        <div className="calculator-error" role="alert">
          {error}
        </div>
      )}
      <div className="calculator-keypad">
        <button className="key key-clear" onClick={clear}>
          C
        </button>
        <button className="key key-op" onClick={() => chooseOperation("divide")}>
          {OPERATION_SYMBOLS.divide}
        </button>
        <button className="key key-op" onClick={() => chooseOperation("multiply")}>
          {OPERATION_SYMBOLS.multiply}
        </button>
        <button className="key key-op" onClick={() => chooseOperation("subtract")}>
          {OPERATION_SYMBOLS.subtract}
        </button>

        {["7", "8", "9"].map((d) => (
          <button key={d} className="key" onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button className="key key-op key-tall" onClick={() => chooseOperation("add")}>
          {OPERATION_SYMBOLS.add}
        </button>

        {["4", "5", "6"].map((d) => (
          <button key={d} className="key" onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}

        {["1", "2", "3"].map((d) => (
          <button key={d} className="key" onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button className="key key-equals key-tall" onClick={equals}>
          =
        </button>

        <button className="key key-zero" onClick={() => inputDigit("0")}>
          0
        </button>
        <button className="key" onClick={inputDecimal}>
          .
        </button>
      </div>
    </div>
  );
}

function formatResult(value: number): string {
  if (!Number.isFinite(value)) {
    return "Error";
  }
  return Number(value.toFixed(10)).toString();
}

/**
 * Groups the integer part into thousands (e.g. "1234567" -> "1,234,567").
 * Chunking long digit strings this way keeps them within short-term working
 * memory's ~7-item span (Miller's Law) instead of one unbroken run of digits.
 * Purely a display concern — the underlying numeric value is untouched.
 */
function formatForDisplay(value: string): string {
  if (value === "Error") {
    return value;
  }
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integerPart, ...decimalParts] = unsigned.split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimalSuffix = decimalParts.length > 0 ? "." + decimalParts.join(".") : "";
  return (negative ? "-" : "") + grouped + decimalSuffix;
}
