import { BINARY_OPERATIONS, UNARY_OPERATIONS } from "../calculator/operations";
import { useCalculator } from "../calculator/useCalculator";
import { useKeyboardInput } from "../calculator/useKeyboardInput";
import { formatForDisplay, formatResult } from "../format";
import "./Calculator.css";

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

  useKeyboardInput(calculator);

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
              `${formatForDisplay(formatResult(pending.operand))} ${BINARY_OPERATIONS[pending.operation].symbol}`)}
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
            {UNARY_OPERATIONS[operation].label}
          </button>
        ))}
        <button
          type="button"
          className="key key-function"
          onClick={() => chooseOperation("power")}
          disabled={busy}
        >
          {BINARY_OPERATIONS.power.label}
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
            {BINARY_OPERATIONS[operation].label}
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
          {BINARY_OPERATIONS.add.label}
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
