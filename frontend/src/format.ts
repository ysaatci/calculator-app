/**
 * Display formatting for the calculator. Pure string/number work, kept apart
 * from the component so the edge cases can be tested directly.
 */

/**
 * Turns a result from the API into the string shown on the display.
 *
 * Rounding to ten decimal places is what hides binary floating-point
 * artefacts: 0.1 + 0.2 arrives as 0.30000000000000004 and has to read as
 * "0.3", or the calculator looks broken to anyone who trusts it.
 */
export function formatResult(value: number): string {
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
export function formatForDisplay(value: string): string {
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
