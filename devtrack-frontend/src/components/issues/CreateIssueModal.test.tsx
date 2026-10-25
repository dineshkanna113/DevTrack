import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { makeIssue, renderWithProviders } from "@/test/utils";
import { CreateIssueModal } from "./CreateIssueModal";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      health: vi.fn(),
      members: vi.fn(),
      triage: vi.fn(),
      createIssue: vi.fn(),
    },
  };
});

const setup = (aiEnabled: boolean) => {
  vi.mocked(api.health).mockResolvedValue({ status: "ok", database: "ok", ai_enabled: aiEnabled, version: "2.0.0" });
  vi.mocked(api.members).mockResolvedValue([
    { user: { id: 7, email: "p@x.com", full_name: "Priya Sharma" }, role: "member", joined_at: "" },
  ]);
  const onClose = vi.fn();
  renderWithProviders(<CreateIssueModal projectId={1} open onClose={onClose} />);
  return { onClose };
};

describe("CreateIssueModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an issue with the selected fields", async () => {
    vi.mocked(api.createIssue).mockResolvedValue(makeIssue({ key: "DT-9" }));
    const { onClose } = setup(false);

    await userEvent.type(screen.getByLabelText("Title"), "Export to CSV");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "feature");
    await screen.findByRole("option", { name: "Priya Sharma" });
    await userEvent.selectOptions(screen.getByLabelText("Assignee"), "7");
    await userEvent.click(screen.getByRole("button", { name: "Create issue" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.createIssue).toHaveBeenCalledWith(1, {
      title: "Export to CSV",
      description: "",
      type: "feature",
      priority: "medium",
      assignee_id: 7,
      due_date: null,
    });
  });

  it("hides AI triage when the backend has no API key", async () => {
    setup(false);
    await waitFor(() => expect(api.health).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /triage with ai/i })).not.toBeInTheDocument();
  });

  it("shows AI suggestions and duplicates, and applies them to the form", async () => {
    vi.mocked(api.triage).mockResolvedValue({
      type: "bug",
      priority: "critical",
      suggested_title: "Login fails for mixed-case emails",
      summary: "Users with uppercase emails cannot sign in.",
      reasoning: "Core auth flow is broken with no workaround.",
      duplicates: [{ id: 3, key: "DT-3", title: "Cannot sign in on Safari" }],
    });
    setup(true);

    const triage = await screen.findByRole("button", { name: /triage with ai/i });
    expect(triage).toBeDisabled(); // needs a title first
    await userEvent.type(screen.getByLabelText("Title"), "login broken");
    await userEvent.type(screen.getByLabelText("Description"), "Mixed@Case.com can't log in");
    await userEvent.click(triage);

    expect(await screen.findByText("Possible duplicates")).toBeInTheDocument();
    expect(screen.getByText("Cannot sign in on Safari")).toBeInTheDocument();
    expect(api.triage).toHaveBeenCalledWith(1, "login broken", "Mixed@Case.com can't log in");

    await userEvent.click(screen.getByRole("button", { name: "Apply suggestions" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Login fails for mixed-case emails");
    expect(screen.getByLabelText("Type")).toHaveValue("bug");
    expect(screen.getByLabelText("Priority")).toHaveValue("critical");
  });
});
