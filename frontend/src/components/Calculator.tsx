import { useEffect, useState } from "react";
import {
  calculate,
  CalculatorApiError,
  type BinaryOperation,
  type Operation,
  type UnaryOperation,
} from "../api/calculatorApi";
import "./Calculator.css";

const OPERATION_SYMBOLS: Record<Operation, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  power: "^",
  sqrt: "√",
  percent: "%",
};

// Keyboard equivalents for the on-screen keys. Every shortcut maps to a key
// that exists in the UI, so the two input methods stay in sync.
const KEY_TO_BINARY_OPERATION: Record<string, BinaryOperation> = {
  "+": "add",
  "-": "subtract",
  "*": "multiply",
  "/": "divide",
  "^": "power",
};

const KEY_TO_UNARY_OPERATION: Record<string, UnaryOperation> = {
  r: "sqrt",
  "%": "percent",
};

interface State {
  display: string;
  storedValue: number | null;
  pendingOperation: BinaryOperation | null;
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
    if (state.loading) {
      return;
    }
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
    if (state.loading) {
      return;
    }
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

  async function chooseOperation(operation: BinaryOperation) {
    // A calculation replaces the whole state when it resolves, so input
    // accepted while one is in flight would be silently discarded.
    if (state.loading) {
      return;
    }
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
    if (state.loading) {
      return;
    }
    if (state.pendingOperation === null || state.storedValue === null || state.error) {
      return;
    }
    await runCalculation(state.pendingOperation, state.storedValue, Number(state.display), null);
  }

  // Unary operations act on the displayed value straight away, the way the
  // "%" and "√" keys do on a pocket calculator. Any pending binary operation
  // is left untouched, so "5 + 9 √ =" still adds 5 to the root of 9.
  async function applyUnaryOperation(operation: UnaryOperation) {
    if (state.loading) {
      return;
    }
    if (state.error) {
      setState(INITIAL_STATE);
      return;
    }

    const value = Number(state.display);
    setState((s) => ({ ...s, loading: true }));
    try {
      const { result } = await calculate(operation, value);
      setState((s) => ({
        ...s,
        display: formatResult(result),
        overwrite: true,
        error: null,
        loading: false,
      }));
    } catch (err) {
      setState(failedState(err));
    }
  }

  async function runCalculation(
    operation: BinaryOperation,
    a: number,
    b: number,
    nextPendingOperation: BinaryOperation | null,
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
      setState(failedState(err));
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      // A focused key already activates itself on Enter/Space; handling the
      // event here as well would apply the same press twice.
      const activatingFocusedKey =
        document.activeElement instanceof HTMLButtonElement &&
        (event.key === "Enter" || event.key === " ");
      if (activatingFocusedKey) {
        return;
      }

      const { key } = event;

      if (key >= "0" && key <= "9") {
        inputDigit(key);
      } else if (key === "." || key === ",") {
        inputDecimal();
      } else if (key in KEY_TO_BINARY_OPERATION) {
        void chooseOperation(KEY_TO_BINARY_OPERATION[key]);
      } else if (key.toLowerCase() in KEY_TO_UNARY_OPERATION) {
        void applyUnaryOperation(KEY_TO_UNARY_OPERATION[key.toLowerCase()]);
      } else if (key === "Enter" || key === "=") {
        void equals();
      } else if (key === "Escape" || key === "c" || key === "C") {
        clear();
      } else {
        return;
      }

      event.preventDefault();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // Deliberately re-subscribed on every render: the handlers close over the
    // current state, so a stale listener would act on stale operands.
  });

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
      <div className="calculator-functions">
        {(["sqrt", "percent"] as const).map((operation) => (
          <button
            key={operation}
            type="button"
            className="key key-function"
            onClick={() => applyUnaryOperation(operation)}
            disabled={loading}
          >
            {OPERATION_SYMBOLS[operation]}
          </button>
        ))}
        <button
          type="button"
          className="key key-function"
          onClick={() => chooseOperation("power")}
          disabled={loading}
        >
          x&#x02B8;
        </button>
      </div>
      <div className="calculator-keypad">
        <button type="button" className="key key-clear" onClick={clear} disabled={loading}>
          C
        </button>
        {(["divide", "multiply", "subtract"] as const).map((operation) => (
          <button
            key={operation}
            type="button"
            className="key key-op"
            onClick={() => chooseOperation(operation)}
            disabled={loading}
          >
            {OPERATION_SYMBOLS[operation]}
          </button>
        ))}

        {["7", "8", "9"].map((d) => (
          <button key={d} type="button" className="key" onClick={() => inputDigit(d)} disabled={loading}>
            {d}
          </button>
        ))}
        <button
          type="button"
          className="key key-op key-tall"
          onClick={() => chooseOperation("add")}
          disabled={loading}
        >
          {OPERATION_SYMBOLS.add}
        </button>

        {["4", "5", "6", "1", "2", "3"].map((d) => (
          <button key={d} type="button" className="key" onClick={() => inputDigit(d)} disabled={loading}>
            {d}
          </button>
        ))}
        <button type="button" className="key key-equals key-tall" onClick={equals} disabled={loading}>
          =
        </button>

        <button type="button" className="key key-zero" onClick={() => inputDigit("0")} disabled={loading}>
          0
        </button>
        <button type="button" className="key" onClick={inputDecimal} disabled={loading}>
          .
        </button>
      </div>
    </div>
  );
}

function failedState(err: unknown): State {
  return {
    ...INITIAL_STATE,
    display: "Error",
    overwrite: true,
    error: err instanceof CalculatorApiError ? err.message : "Unexpected error",
  };
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
