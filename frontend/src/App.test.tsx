import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the calculator", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Calculator" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Calculator" })).toBeInTheDocument();
  });
});
