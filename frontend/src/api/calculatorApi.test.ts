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
