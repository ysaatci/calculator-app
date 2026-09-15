import { afterEach, describe, expect, it, vi } from "vitest";
import { calculate, CalculatorApiError } from "./calculatorApi";

describe("calculate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed result on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ operation: "add", a: 2, b: 3, result: 5 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await calculate("add", 2, 3);

    expect(result).toEqual({ operation: "add", a: 2, b: 3, result: 5 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/calculate"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ operation: "add", a: 2, b: 3 }),
      }),
    );
  });

  it("throws CalculatorApiError with the backend's message on a 4xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "division by zero" }),
      }),
    );

    await expect(calculate("divide", 1, 0)).rejects.toThrow(CalculatorApiError);
    await expect(calculate("divide", 1, 0)).rejects.toThrow("division by zero");
  });

  it("rejects a 2xx response whose body isn't a usable result", async () => {
    // A backend that fails to encode its response can still return 200 with
    // an empty body; blindly trusting it would surface as a crash later.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => null }),
    );

    await expect(calculate("multiply", 1e308, 1e308)).rejects.toThrow(
      CalculatorApiError,
    );
  });

  it("rejects a result that isn't a finite number", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ operation: "add", a: 1, b: 2, result: "three" }),
      }),
    );

    await expect(calculate("add", 1, 2)).rejects.toThrow(CalculatorApiError);
  });

  it("gives up on a request that never settles", async () => {
    vi.useFakeTimers();
    // A fetch that hangs forever until its abort signal fires - the failure
    // mode that would otherwise leave the UI waiting with no way out.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              const err = new Error("aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      ),
    );

    const pending = calculate("add", 1, 2);
    const assertion = expect(pending).rejects.toThrow("took too long");
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;

    vi.useRealTimers();
  });

  it("throws CalculatorApiError when the network request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("network error")),
    );

    await expect(calculate("add", 1, 2)).rejects.toThrow(CalculatorApiError);
    await expect(calculate("add", 1, 2)).rejects.toThrow(
      "Could not reach the calculator service",
    );
  });
});
