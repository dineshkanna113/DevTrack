import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, tokenStore } from "@/lib/api";
import { renderWithProviders } from "@/test/utils";
import { LoginPage } from "./AuthPages";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, login: vi.fn(), me: vi.fn() } };
});

const me = {
  id: 1,
  email: "demo@devtrack.dev",
  full_name: "Demo User",
  role: "member" as const,
  created_at: "2026-10-01T00:00:00Z",
};

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>Dashboard home</p>} />
    </Routes>,
    { route: "/login" },
  );
}

describe("LoginPage", () => {
  // Braces matter: a function returned from beforeEach is run as a cleanup hook.
  beforeEach(() => {
    vi.mocked(api.login).mockReset();
  });

  it("validates fields before calling the API", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it("stores the token and redirects on success", async () => {
    vi.mocked(api.login).mockResolvedValue({ access_token: "jwt-token" });
    vi.mocked(api.me).mockResolvedValue(me);
    renderLogin();

    await userEvent.type(screen.getByLabelText("Email"), "demo@devtrack.dev");
    await userEvent.type(screen.getByLabelText("Password"), "DemoPass123!");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith("demo@devtrack.dev", "DemoPass123!");
    expect(tokenStore.get()).toBe("jwt-token");
  });

  it("shows the server error message on failure", async () => {
    const { AxiosError, AxiosHeaders } = await import("axios");
    const error = new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 401,
      data: { detail: "Incorrect email or password" },
      statusText: "",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    vi.mocked(api.login).mockRejectedValue(error);
    renderLogin();

    await userEvent.type(screen.getByLabelText("Email"), "demo@devtrack.dev");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
    await waitFor(() => expect(tokenStore.get()).toBeNull());
  });

  it("fills and submits the demo account", async () => {
    vi.mocked(api.login).mockResolvedValue({ access_token: "demo" });
    vi.mocked(api.me).mockResolvedValue(me);
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: /try the demo account/i }));
    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith("demo@devtrack.dev", "DemoPass123!");
  });
});
