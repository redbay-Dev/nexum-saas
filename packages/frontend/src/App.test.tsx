import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { App } from "./App.js";

describe("App", () => {
  it("should render the login page for unauthenticated users", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Enter your credentials to continue")).toBeInTheDocument();
  });

  it("should render the register page", () => {
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Set up your Nexum account")).toBeInTheDocument();
  });
});
