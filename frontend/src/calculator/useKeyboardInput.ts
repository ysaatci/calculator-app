import { useEffect } from "react";
import type { BinaryOperation, UnaryOperation } from "../api/calculatorApi";
import { binaryOperationForKey, unaryOperationForKey } from "./operations";

/** The calculator actions a key press can trigger - all this hook needs. */
export interface KeyboardActions {
  inputDigit(digit: string): void;
  inputDecimal(): void;
  clear(): void;
  chooseOperation(operation: BinaryOperation): unknown;
  applyUnaryOperation(operation: UnaryOperation): unknown;
  equals(): unknown;
}

/**
 * Translates physical key presses into calculator actions, so every key on
 * the pad can also be reached from a keyboard.
 */
export function useKeyboardInput(actions: KeyboardActions) {
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
      const binary = binaryOperationForKey(key);
      const unary = unaryOperationForKey(key);

      if (key >= "0" && key <= "9") {
        actions.inputDigit(key);
      } else if (key === "." || key === ",") {
        actions.inputDecimal();
      } else if (binary) {
        void actions.chooseOperation(binary);
      } else if (unary) {
        void actions.applyUnaryOperation(unary);
      } else if (key === "Enter" || key === "=") {
        void actions.equals();
      } else if (key === "Escape" || key === "c" || key === "C") {
        actions.clear();
      } else {
        return;
      }

      event.preventDefault();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // Deliberately re-subscribed on every render: the actions close over the
    // current state, so a stale listener would act on stale operands.
  });
}
