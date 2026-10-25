import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import type { Issue } from "@/lib/types";

export function renderWithProviders(ui: ReactElement, { route = "/" } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>{ui}</AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

let nextId = 1;
export function makeIssue(overrides: Partial<Issue> = {}): Issue {
  const id = nextId++;
  return {
    id,
    key: `DT-${id}`,
    number: id,
    project_id: 1,
    title: `Issue ${id}`,
    description: "",
    status: "todo",
    priority: "medium",
    type: "task",
    reporter: { id: 1, email: "a@x.com", full_name: "Alice" },
    assignee: null,
    due_date: null,
    created_at: "2026-10-20T10:00:00Z",
    updated_at: "2026-10-20T10:00:00Z",
    resolved_at: null,
    ...overrides,
  };
}
