import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Calculator } from "./Calculator";
import * as api from "../api/calculatorApi";
import { CalculatorApiError, type CalculateResult } from "../api/calculatorApi";

vi.mock("../api/calculatorApi", async () => {
  const actual = await vi.importActual<typeof api>("../api/calculatorApi");
  return { ...actual, calculate: vi.fn() };
});

const calculateMock = vi.mocked(api.calculate);

function pressButtons(labels: string[]) {
  const user = userEvent.setup();
  return async () => {
    for (const label of labels) {
      await user.click(screen.getByRole("button", { name: label }));
    }
  };
}

describe("Calculator", () => {
  it("performs an addition and calls the API with the right operands", async () => {
    calculateMock.mockResolvedValue({ operation: "add", a: 2, b: 3, result: 5 });
    render(<Calculator />);

    await pressButtons(["2", "+", "3", "="])();

    expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({ operation: "add", a: 2, b: 3 }));
    expect(screen.getByTestId("display")).toHaveTextContent("5");
  });

  it("applies a unary operation to the displayed value immediately", async () => {
    calculateMock.mockResolvedValue({ operation: "sqrt", a: 9, result: 3 });
    render(<Calculator />);

    await pressButtons(["9", "√"])();

    // No second operand, and no "=" needed.
    expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({ operation: "sqrt", a: 9 }));
    expect(screen.getByTestId("display")).toHaveTextContent("3");
  });

  it("keeps a pending operation while a unary operation is applied", async () => {
    calculateMock.mockResolvedValue({ operation: "sqrt", a: 9, result: 3 });
    render(<Calculator />);

    await pressButtons(["5", "+", "9", "√"])();
    expect(calculateMock).toHaveBeenLastCalledWith(expect.objectContaining({ operation: "sqrt", a: 9 }));

    calculateMock.mockResolvedValue({ operation: "add", a: 5, b: 3, result: 8 });
    await pressButtons(["="])();

    expect(calculateMock).toHaveBeenLastCalledWith(expect.objectContaining({ operation: "add", a: 5, b: 3 }));
    expect(screen.getByTestId("display")).toHaveTextContent("8");
  });

  it("converts the displayed value with the percent key", async () => {
    calculateMock.mockResolvedValue({ operation: "percent", a: 50, result: 0.5 });
    render(<Calculator />);

    await pressButtons(["5", "0", "%"])();

    expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({ operation: "percent", a: 50 }));
    expect(screen.getByTestId("display")).toHaveTextContent("0.5");
  });

  it("raises a number to a power as a two-operand operation", async () => {
    calculateMock.mockResolvedValue({ operation: "power", a: 2, b: 10, result: 1024 });
    render(<Calculator />);

    await pressButtons(["2", "xʸ", "1", "0", "="])();

    expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({ operation: "power", a: 2, b: 10 }));
    expect(screen.getByTestId("display")).toHaveTextContent("1,024");
  });

  it("surfaces a backend error from a unary operation", async () => {
    calculateMock.mockRejectedValue(
      new CalculatorApiError("square root of a negative number"),
    );
    render(<Calculator />);

    await pressButtons(["9", "√"])();

    expect(screen.getByTestId("display")).toHaveTextContent("Error");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "square root of a negative number",
    );
  });

  it("blocks a second decimal point in the same number", async () => {
    render(<Calculator />);

    await pressButtons(["1", ".", "2", ".", "5"])();

    expect(screen.getByTestId("display")).toHaveTextContent("1.25");
  });

  it("shows a friendly error message when the backend reports division by zero", async () => {
    calculateMock.mockRejectedValue(new CalculatorApiError("division by zero"));
    render(<Calculator />);

    await pressButtons(["5", "÷", "0", "="])();

    expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({ operation: "divide", a: 5, b: 0 }));
    expect(screen.getByTestId("display")).toHaveTextContent("Error");
    expect(screen.getByRole("alert")).toHaveTextContent("division by zero");
  });

  it("clears the display and any error state when C is pressed", async () => {
    calculateMock.mockRejectedValue(new CalculatorApiError("division by zero"));
    render(<Calculator />);

    await pressButtons(["5", "÷", "0", "="])();
    expect(screen.getByTestId("display")).toHaveTextContent("Error");

    await pressButtons(["C"])();

    expect(screen.getByTestId("display")).toHaveTextContent("0");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("starts a fresh number when a digit is typed right after an error, without pressing C", async () => {
    calculateMock.mockRejectedValue(new CalculatorApiError("division by zero"));
    render(<Calculator />);

    await pressButtons(["5", "÷", "0", "="])();
    expect(screen.getByTestId("display")).toHaveTextContent("Error");

    await pressButtons(["7"])();

    expect(screen.getByTestId("display")).toHaveTextContent("7");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("starts a new pending operation when an operator is pressed right after an error", async () => {
    calculateMock.mockRejectedValueOnce(new CalculatorApiError("division by zero"));
    render(<Calculator />);

    await pressButtons(["5", "÷", "0", "="])();
    expect(screen.getByTestId("display")).toHaveTextContent("Error");

    calculateMock.mockResolvedValue({ operation: "add", a: 0, b: 9, result: 9 });
    await pressButtons(["+", "9", "="])();

    expect(calculateMock).toHaveBeenLastCalledWith(expect.objectContaining({ operation: "add", a: 0, b: 9 }));
    expect(screen.getByTestId("display")).toHaveTextContent("9");
  });

  it("accepts keyboard input as well as clicks", async () => {
    const user = userEvent.setup();
    calculateMock.mockResolvedValue({ operation: "add", a: 12, b: 3, result: 15 });
    render(<Calculator />);

    await user.keyboard("12+3{Enter}");

    expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({ operation: "add", a: 12, b: 3 }));
    expect(screen.getByTestId("display")).toHaveTextContent("15");
  });

  it("maps keyboard shortcuts to the function keys", async () => {
    const user = userEvent.setup();
    calculateMock.mockResolvedValue({ operation: "sqrt", a: 16, result: 4 });
    render(<Calculator />);

    await user.keyboard("16r");
    expect(calculateMock).toHaveBeenLastCalledWith(expect.objectContaining({ operation: "sqrt", a: 16 }));

    calculateMock.mockResolvedValue({ operation: "power", a: 4, b: 3, result: 64 });
    await user.keyboard("^3{Enter}");

    expect(calculateMock).toHaveBeenLastCalledWith(expect.objectContaining({ operation: "power", a: 4, b: 3 }));
    expect(screen.getByTestId("display")).toHaveTextContent("64");
  });

  it("still reads Enter as equals after keys were clicked with the mouse", async () => {
    // A clicked key must not keep focus, or Enter re-fires that key instead
    // of submitting the calculation.
    const user = userEvent.setup();
    calculateMock.mockResolvedValue({ operation: "divide", a: 48, b: 6, result: 8 });
    render(<Calculator />);

    await pressButtons(["C"])();
    await user.keyboard("48/6{Enter}");

    expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({ operation: "divide", a: 48, b: 6 }));
    expect(screen.getByTestId("display")).toHaveTextContent("8");
  });

  it("clears via the Escape key", async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    await user.keyboard("42");
    expect(screen.getByTestId("display")).toHaveTextContent("42");

    await user.keyboard("{Escape}");
    expect(screen.getByTestId("display")).toHaveTextContent("0");
  });

  it("ignores further input while a calculation is in flight", async () => {
    let resolveCalculation!: (value: CalculateResult) => void;
    calculateMock.mockReturnValue(
      new Promise<CalculateResult>((resolve) => {
        resolveCalculation = resolve;
      }),
    );
    render(<Calculator />);

    await pressButtons(["2", "+", "3", "="])();

    // Keys are disabled, so a stray press can't be discarded by the
    // in-flight calculation when it replaces the state.
    expect(screen.getByRole("button", { name: "7" })).toBeDisabled();
    await pressButtons(["7"])();

    await act(async () => {
      resolveCalculation({ operation: "add", a: 2, b: 3, result: 5 });
    });

    expect(calculateMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("display")).toHaveTextContent("5");
  });

  it("ignores keystrokes while a calculation is in flight", async () => {
    const user = userEvent.setup();
    let resolveCalculation!: (value: CalculateResult) => void;
    calculateMock.mockReturnValue(
      new Promise<CalculateResult>((resolve) => {
        resolveCalculation = resolve;
      }),
    );
    render(<Calculator />);

    await user.keyboard("2+3{Enter}");
    // Disabled buttons block the mouse; this guards the keyboard path.
    // Escape is deliberately exempt - see the clear-as-escape-hatch test.
    await user.keyboard("7.9*");

    await act(async () => {
      resolveCalculation({ operation: "add", a: 2, b: 3, result: 5 });
    });

    expect(calculateMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("display")).toHaveTextContent("5");
  });

  it("lets C rescue the keypad while a request is in flight", async () => {
    let resolveCalculation!: (value: CalculateResult) => void;
    calculateMock.mockReturnValue(
      new Promise<CalculateResult>((resolve) => {
        resolveCalculation = resolve;
      }),
    );
    render(<Calculator />);

    await pressButtons(["2", "+", "3", "="])();

    // Every other key is locked, but a hung backend must not trap the user.
    expect(screen.getByRole("button", { name: "7" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "C" })).toBeEnabled();

    await pressButtons(["C"])();
    expect(screen.getByTestId("display")).toHaveTextContent("0");
    expect(screen.getByRole("button", { name: "7" })).toBeEnabled();

    // The abandoned reply must not overwrite what the user reset to.
    await act(async () => {
      resolveCalculation({ operation: "add", a: 2, b: 3, result: 5 });
    });
    expect(screen.getByTestId("display")).toHaveTextContent("0");
  });

  it("ignores unrelated keys and modifier shortcuts", async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    await user.keyboard("5");
    await user.keyboard("{a}{F5}{Control>}9{/Control}");

    expect(screen.getByTestId("display")).toHaveTextContent("5");
    expect(calculateMock).not.toHaveBeenCalled();
  });

  it("does nothing when equals is pressed with no pending operation", async () => {
    render(<Calculator />);

    await pressButtons(["8", "="])();

    expect(calculateMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("display")).toHaveTextContent("8");
  });

  it("chains operations without pressing equals in between", async () => {
    calculateMock.mockResolvedValue({ operation: "add", a: 2, b: 3, result: 5 });
    render(<Calculator />);

    await pressButtons(["2", "+", "3", "×"])();
    expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({ operation: "add", a: 2, b: 3 }));

    calculateMock.mockResolvedValue({ operation: "multiply", a: 5, b: 4, result: 20 });
    await pressButtons(["4", "="])();
    expect(calculateMock).toHaveBeenLastCalledWith(expect.objectContaining({ operation: "multiply", a: 5, b: 4 }));
    expect(screen.getByTestId("display")).toHaveTextContent("20");
  });

  // The pending "5 +" used to be thrown away here, giving 3 × 2 = 6. A unary
  // result is a real operand, so the operator after it has to resolve the
  // sum in progress before chaining.
  it("resolves a pending sum when an operator follows a unary result", async () => {
    calculateMock.mockImplementation(async ({ operation, a, b }) => {
      const results: Record<string, number> = { sqrt: 3, add: 8, multiply: 16 };
      return { operation, a, b, result: results[operation] };
    });
    render(<Calculator />);

    await pressButtons(["5", "+", "9", "√", "×", "2", "="])();

    expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({ operation: "add", a: 5, b: 3 }));
    expect(calculateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ operation: "multiply", a: 8, b: 2 }),
    );
    expect(screen.getByTestId("display")).toHaveTextContent("16");
  });

  // The guard against the obvious over-correction: straight after a chained
  // result, the displayed value is still the pending operation's own operand,
  // so a second operator must switch the operator rather than calculate.
  it("switches the operator when a second one follows a chained result", async () => {
    calculateMock.mockImplementation(async ({ operation, a, b }) => {
      const results: Record<string, number> = { add: 5, subtract: 1 };
      return { operation, a, b, result: results[operation] };
    });
    render(<Calculator />);

    await pressButtons(["2", "+", "3", "×", "−", "4", "="])();

    // 2 + 3 resolves once; × is then replaced by −, never evaluated as 5 × 5.
    expect(calculateMock).toHaveBeenCalledTimes(2);
    expect(calculateMock).not.toHaveBeenCalledWith(expect.objectContaining({ operation: "multiply" }));
    expect(calculateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ operation: "subtract", a: 5, b: 4 }),
    );
  });

  it("switches the operator when a second one follows the first directly", async () => {
    calculateMock.mockResolvedValue({ operation: "multiply", a: 5, b: 3, result: 15 });
    render(<Calculator />);

    await pressButtons(["5", "+", "×", "3", "="])();

    expect(calculateMock).toHaveBeenCalledTimes(1);
    expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({ operation: "multiply", a: 5, b: 3 }));
  });
});
