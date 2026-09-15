export type Operation = "add" | "subtract" | "multiply" | "divide";

export interface CalculateResult {
  operation: Operation;
  a: number;
  b: number;
  result: number;
}

/**
 * Thrown when the backend rejects a request (validation error, division by
 * zero, unsupported operation, etc.) or responds with a non-2xx status.
 */
export class CalculatorApiError extends Error {}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

/**
 * Calls the backend's single calculate endpoint. The frontend never branches
 * on which operation was picked — it just forwards the operation name,
 * mirroring the backend's strategy-registry design.
 */
export async function calculate(
  operation: Operation,
  a: number,
  b: number,
): Promise<CalculateResult> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/v1/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation, a, b }),
    });
  } catch {
    throw new CalculatorApiError("Could not reach the calculator service");
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body.error === "string" ? body.error : "Calculation failed";
    throw new CalculatorApiError(message);
  }

  return body as CalculateResult;
}
