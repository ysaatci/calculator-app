import { useEffect } from "react";
import type { BinaryOperation, Operation, UnaryOperation } from "../api/calculatorApi";
import { useCalculator } from "../calculator/useCalculator";
import { formatForDisplay, formatResult } from "../format";
import "./Calculator.css";

/** Compact glyphs, used on keys and in the pending-operation indicator. */
const OPERATION_SYMBOLS: Record<Operation, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  power: "^",
  sqrt: "√",
  percent: "%",
};

/**
 * Where a key reads better than its compact glyph. "xʸ" is the conventional
 * label for a power key, but it is too wide for the indicator that sits under
 * the running value, which uses "^" instead.
 */
const KEY_LABELS: Partial<Record<Operation, string>> = {
  power: "xʸ",
};

function keyLabel(operation: Operation): string {
  return KEY_LABELS[operation] ?? OPERATION_SYMBOLS[operation];
}

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

export function Calculator() {
  const calculator = useCalculator();
  const {
    display,
    pending,
    error,
    busy,
    inputDigit,
    inputDecimal,
    clear,
    chooseOperation,
    applyUnaryOperation,
    equals,
  } = calculator;

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
      <div className="calculator-display">
        {/*
          One line for whatever context the value needs: the sum being built,
          or why it failed. Always present in the layout, so neither pressing
          an operator nor hitting an error shifts the keypad.
        */}
        <span
          className={`calculator-display-context${error ? " calculator-display-context-error" : ""}`}
          role={error ? "alert" : undefined}
          data-testid="expression"
        >
          {error ??
            (pending &&
              `${formatForDisplay(formatResult(pending.operand))} ${OPERATION_SYMBOLS[pending.operation]}`)}
        </span>
        <span className="calculator-display-value" data-testid="display" aria-live="polite">
          {formatForDisplay(display)}
        </span>
      </div>
      <div className="calculator-functions" onMouseDown={keepFocusOffClickedKeys}>
        {(["sqrt", "percent"] as const).map((operation) => (
          <button
            key={operation}
            type="button"
            className="key key-function"
            onClick={() => applyUnaryOperation(operation)}
            disabled={busy}
          >
            {keyLabel(operation)}
          </button>
        ))}
        <button
          type="button"
          className="key key-function"
          onClick={() => chooseOperation("power")}
          disabled={busy}
        >
          {keyLabel("power")}
        </button>
      </div>
      <div className="calculator-keypad" onMouseDown={keepFocusOffClickedKeys}>
        <button type="button" className="key key-clear" onClick={clear}>
          C
        </button>
        {(["divide", "multiply", "subtract"] as const).map((operation) => (
          <button
            key={operation}
            type="button"
            className="key key-op"
            onClick={() => chooseOperation(operation)}
            disabled={busy}
          >
            {keyLabel(operation)}
          </button>
        ))}

        {["7", "8", "9"].map((d) => (
          <button key={d} type="button" className="key" onClick={() => inputDigit(d)} disabled={busy}>
            {d}
          </button>
        ))}
        <button
          type="button"
          className="key key-op key-tall"
          onClick={() => chooseOperation("add")}
          disabled={busy}
        >
          {keyLabel("add")}
        </button>

        {["4", "5", "6", "1", "2", "3"].map((d) => (
          <button key={d} type="button" className="key" onClick={() => inputDigit(d)} disabled={busy}>
            {d}
          </button>
        ))}
        <button type="button" className="key key-equals key-tall" onClick={equals} disabled={busy}>
          =
        </button>

        <button type="button" className="key key-zero" onClick={() => inputDigit("0")} disabled={busy}>
          0
        </button>
        <button type="button" className="key" onClick={inputDecimal} disabled={busy}>
          .
        </button>
      </div>
    </div>
  );
}

/**
 * Stops a mouse click from leaving focus on the key it hit, without touching
 * keyboard focus. Otherwise the clicked key stays focused and swallows the
 * next Enter — click "C", type "48/6", press Enter, and Enter re-fires "C"
 * instead of "=". Tabbing to a key still focuses it, so Enter and Space go
 * on activating the focused key for keyboard users.
 */
function keepFocusOffClickedKeys(event: React.MouseEvent) {
  event.preventDefault();
}
