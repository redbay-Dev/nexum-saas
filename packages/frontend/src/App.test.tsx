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

  it("should show loading state for protected routes when not authenticated", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    // ProtectedRoute shows skeleton while checking auth, then redirects
    // During the pending phase, skeletons are shown
    const skeletons = document.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
