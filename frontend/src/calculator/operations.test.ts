import { describe, expect, it } from "vitest";
import {
  BINARY_OPERATIONS,
  binaryOperationForKey,
  UNARY_OPERATIONS,
  unaryOperationForKey,
} from "./operations";

describe("keyboard shortcuts", () => {
  it.each([
    ["+", "add"],
    ["-", "subtract"],
    ["*", "multiply"],
    ["/", "divide"],
    ["^", "power"],
  ])("maps %s to %s", (key, operation) => {
    expect(binaryOperationForKey(key)).toBe(operation);
  });

  it("maps unary shortcuts regardless of case", () => {
    expect(unaryOperationForKey("r")).toBe("sqrt");
    expect(unaryOperationForKey("R")).toBe("sqrt");
    expect(unaryOperationForKey("%")).toBe("percent");
  });

  it("ignores keys that aren't shortcuts", () => {
    expect(binaryOperationForKey("x")).toBeUndefined();
    expect(unaryOperationForKey("q")).toBeUndefined();
  });

  // A new operation that reused a shortcut would silently shadow an existing
  // one, depending only on which table happened to be searched first.
  it("gives every operation its own shortcut", () => {
    const keys = [...Object.values(BINARY_OPERATIONS), ...Object.values(UNARY_OPERATIONS)].map(
      (info) => info.key,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
