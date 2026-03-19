import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { App } from "./App.js";

describe("App", () => {
  it("should render the landing page", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Nexum")).toBeInTheDocument();
  });
});
