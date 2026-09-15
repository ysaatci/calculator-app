import type { BinaryOperation, UnaryOperation } from "../api/calculatorApi";

/** Everything the UI needs to know about one operation. */
export interface OperationInfo {
  /** Compact glyph, used in the display's expression line. */
  symbol: string;
  /** Text on the key. Usually the symbol; "xʸ" reads better on a key than "^". */
  label: string;
  /** Keyboard shortcut. */
  key: string;
}

/*
 * One entry per operation. Keyed by the operation unions, so adding an
 * operation to BinaryOperation or UnaryOperation is a compile error until it
 * has an entry here - symbol, key label and shortcut are decided in one place
 * rather than in several maps the compiler can't hold together.
 */
export const BINARY_OPERATIONS: Record<BinaryOperation, OperationInfo> = {
  add: { symbol: "+", label: "+", key: "+" },
  subtract: { symbol: "−", label: "−", key: "-" },
  multiply: { symbol: "×", label: "×", key: "*" },
  divide: { symbol: "÷", label: "÷", key: "/" },
  power: { symbol: "^", label: "xʸ", key: "^" },
};

export const UNARY_OPERATIONS: Record<UnaryOperation, OperationInfo> = {
  sqrt: { symbol: "√", label: "√", key: "r" },
  percent: { symbol: "%", label: "%", key: "%" },
};

export function binaryOperationForKey(key: string): BinaryOperation | undefined {
  return findByKey(BINARY_OPERATIONS, key);
}

export function unaryOperationForKey(key: string): UnaryOperation | undefined {
  return findByKey(UNARY_OPERATIONS, key);
}

function findByKey<T extends string>(table: Record<T, OperationInfo>, key: string): T | undefined {
  const pressed = key.toLowerCase();
  return (Object.keys(table) as T[]).find((operation) => table[operation].key === pressed);
}
