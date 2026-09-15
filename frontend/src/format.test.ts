import { describe, expect, it } from "vitest";
import { formatForDisplay, formatResult } from "./format";

describe("formatResult", () => {
  it.each([
    // The reason rounding exists at all: 0.1 + 0.2 comes back from the API
    // as 0.30000000000000004, and a calculator that shows that looks broken.
    [0.30000000000000004, "0.3"],
    [0.1 + 0.2, "0.3"],
    [1 / 3, "0.3333333333"],
    [5, "5"],
    [-2.5, "-2.5"],
    [0, "0"],
    [-0, "0"],
    [1024, "1024"],
    [2.5e-11, "0"], // rounds away below the tenth decimal place
  ])("formats %p as %p", (value, expected) => {
    expect(formatResult(value)).toBe(expected);
  });

  it.each([Infinity, -Infinity, NaN])("reports %p as an error", (value) => {
    expect(formatResult(value)).toBe("Error");
  });
});

describe("formatForDisplay", () => {
  it.each([
    ["0", "0"],
    ["5", "5"],
    ["999", "999"],
    ["1000", "1,000"],
    ["998001", "998,001"],
    ["1234567890", "1,234,567,890"],
    ["-9876543", "-9,876,543"],
    // Only the integer part is grouped; digits after the point are not.
    ["1234.5678", "1,234.5678"],
    ["-1234.5", "-1,234.5"],
    ["0.5", "0.5"],
  ])("groups %p as %p", (value, expected) => {
    expect(formatForDisplay(value)).toBe(expected);
  });

  it("leaves a half-typed decimal alone", () => {
    // The user has pressed "." but no digit yet; swallowing it would make
    // the key look broken.
    expect(formatForDisplay("12.")).toBe("12.");
  });

  it("passes the error placeholder through untouched", () => {
    expect(formatForDisplay("Error")).toBe("Error");
  });

  it("does not corrupt exponential notation", () => {
    // Very large results arrive as "1e+21"; grouping must not mangle them.
    expect(formatForDisplay("1e+21")).toBe("1e+21");
  });
});
