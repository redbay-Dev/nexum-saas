import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { App } from "./App.js";

// Mock fetch to prevent real network calls in tests
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url === "/api/v1/auth/me") {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () =>
            Promise.resolve({ error: "Unauthenticated", code: "UNAUTHENTICATED" }),
        });
      }
      if (url === "/api/v1/auth/login-url") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                loginUrl: "http://localhost:3000/login?product=nexum",
                signupUrl: "http://localhost:3000/signup?product=nexum",
              },
            }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Not found", code: "NOT_FOUND" }),
      });
    }),
  );

  // Mock window.location for redirect tests
  Object.defineProperty(window, "location", {
    value: { href: "" },
    writable: true,
  });
});

describe("App", () => {
  it("should render the auth error page", () => {
    render(
      <MemoryRouter initialEntries={["/auth-error?error=invalid_token"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Authentication Error")).toBeInTheDocument();
  });

  it("should redirect unauthenticated users to login from protected routes", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    // ProtectedRoute checks auth (returns 401), then redirects to /login
    // The login page auto-redirects to OpShield, showing "Redirecting to login..."
    const redirectText = await screen.findByText("Redirecting to login...");
    expect(redirectText).toBeInTheDocument();
  });
});
