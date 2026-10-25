import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeIssue } from "@/test/utils";
import { KanbanBoard } from "./KanbanBoard";

describe("KanbanBoard", () => {
  const issues = [
    makeIssue({ title: "Fix login", status: "todo", priority: "critical", type: "bug" }),
    makeIssue({ title: "Write docs", status: "todo" }),
    makeIssue({
      title: "Ship charts",
      status: "in_review",
      assignee: { id: 2, email: "p@x.com", full_name: "Priya Sharma" },
    }),
    makeIssue({ title: "Old task", status: "done", due_date: "2000-01-01" }),
  ];

  it("groups issues into status columns with counts", () => {
    render(<KanbanBoard issues={issues} onOpen={vi.fn()} onMove={vi.fn()} />);

    const todo = screen.getByRole("region", { name: "To do column" });
    expect(within(todo).getAllByRole("listitem")).toHaveLength(2);
    expect(within(todo).getByText("2")).toBeInTheDocument();
    expect(within(todo).getByText("Critical")).toBeInTheDocument();

    const review = screen.getByRole("region", { name: "In review column" });
    expect(within(review).getByText("Ship charts")).toBeInTheDocument();
    expect(within(review).getByTitle("Priya Sharma")).toHaveTextContent("PS");

    expect(within(screen.getByRole("region", { name: "In progress column" })).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("does not flag done issues as overdue", () => {
    render(<KanbanBoard issues={issues} onOpen={vi.fn()} onMove={vi.fn()} />);
    expect(screen.queryByText("Overdue:")).not.toBeInTheDocument();
  });

  it("opens an issue when its title is clicked", async () => {
    const onOpen = vi.fn();
    render(<KanbanBoard issues={issues} onOpen={onOpen} onMove={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Fix login/ }));
    expect(onOpen).toHaveBeenCalledWith(issues[0]);
  });
});
