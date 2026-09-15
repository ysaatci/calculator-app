/** Operations taking two operands, entered as `a <op> b`. */
export type BinaryOperation = "add" | "subtract" | "multiply" | "divide" | "power";

/** Operations applied to the displayed value on their own. */
export type UnaryOperation = "sqrt" | "percent";

export type Operation = BinaryOperation | UnaryOperation;

export interface CalculateResult {
  operation: Operation;
  a: number;
  b?: number;
  result: number;
}

/**
 * Thrown when the backend rejects a request (validation error, division by
 * zero, unsupported operation, etc.) or responds with a non-2xx status.
 */
export class CalculatorApiError extends Error {}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

/**
 * Without a deadline a request that never settles leaves the UI waiting
 * forever. Arithmetic is instant, so anything this slow is a broken
 * connection rather than a slow answer.
 */
const REQUEST_TIMEOUT_MS = 8000;

export interface CalculateRequest {
  operation: Operation;
  a: number;
  /** Omitted for unary operations; the backend rejects a wrong operand count. */
  b?: number;
  /** Aborts the request when the caller no longer needs the answer. */
  signal?: AbortSignal;
}

/**
 * Calls the backend's single calculate endpoint. The frontend never branches
 * on which operation was picked — it just forwards the operation name,
 * mirroring the backend's strategy-registry design.
 */
export async function calculate({
  operation,
  a,
  b,
  signal,
}: CalculateRequest): Promise<CalculateResult> {
  // The deadline and the caller's cancellation are the same concern - "this
  // answer is no longer wanted" - so they drive one controller.
  const controller = new AbortController();
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/v1/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // JSON.stringify drops undefined values, so a unary call sends no "b".
      body: JSON.stringify({ operation, a, b }),
      signal: controller.signal,
    });
  } catch (err) {
    // A caller that cancelled deliberately gets the raw abort back, so it can
    // tell "I stopped caring" apart from "the service failed".
    if (signal?.aborted) {
      throw err;
    }
    throw new CalculatorApiError(
      timedOut
        ? "The calculator service took too long to respond"
        : "Could not reach the calculator service",
    );
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener("abort", cancel);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body.error === "string" ? body.error : "Calculation failed";
    throw new CalculatorApiError(message);
  }

  if (!isCalculateResult(body)) {
    throw new CalculatorApiError("Unexpected response from the calculator service");
  }

  return body;
}

function isCalculateResult(body: unknown): body is CalculateResult {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as CalculateResult).result === "number" &&
    Number.isFinite((body as CalculateResult).result)
  );
}
