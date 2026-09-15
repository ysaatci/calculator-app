import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Calculator } from "./Calculator";
import * as api from "../api/calculatorApi";
import { CalculatorApiError } from "../api/calculatorApi";

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

    expect(calculateMock).toHaveBeenCalledWith("add", 2, 3);
    expect(screen.getByTestId("display")).toHaveTextContent("5");
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

    expect(calculateMock).toHaveBeenCalledWith("divide", 5, 0);
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

    expect(calculateMock).toHaveBeenLastCalledWith("add", 0, 9);
    expect(screen.getByTestId("display")).toHaveTextContent("9");
  });

  it("chains operations without pressing equals in between", async () => {
    calculateMock.mockResolvedValue({ operation: "add", a: 2, b: 3, result: 5 });
    render(<Calculator />);

    await pressButtons(["2", "+", "3", "×"])();
    expect(calculateMock).toHaveBeenCalledWith("add", 2, 3);

    calculateMock.mockResolvedValue({ operation: "multiply", a: 5, b: 4, result: 20 });
    await pressButtons(["4", "="])();
    expect(calculateMock).toHaveBeenLastCalledWith("multiply", 5, 4);
    expect(screen.getByTestId("display")).toHaveTextContent("20");
  });
});
