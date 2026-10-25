import clsx from "clsx";
import { ArrowLeft, Columns3, List, Plus, Search, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { CreateIssueModal } from "@/components/issues/CreateIssueModal";
import { DueDate, PriorityBadge, StatusLabel, TypeBadge } from "@/components/issues/IssueBadges";
import { IssueDetailModal } from "@/components/issues/IssueDetailModal";
import { KanbanBoard } from "@/components/issues/KanbanBoard";
import { Avatar, Button, Card, EmptyState, Input, Modal, Select, Spinner } from "@/components/ui";
import { useIssues, useMembers, useProject, useUpdateIssue } from "@/hooks/queries";
import { api, errorMessage } from "@/lib/api";
import { PRIORITIES, STATUS, TYPES } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import type { Issue, IssueFilters, IssuePriority, IssueSort, IssueType } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";

const SORTS: { value: IssueSort; label: string }[] = [
  { value: "-created_at", label: "Newest" },
  { value: "-updated_at", label: "Recently updated" },
  { value: "-priority", label: "Priority" },
  { value: "due_date", label: "Due date" },
  { value: "number", label: "Key" },
];

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function MembersModal({ projectId, open, onClose }: { projectId: number; open: boolean; onClose: () => void }) {
  const { data: members = [] } = useMembers(projectId);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const isOwner = members.some((m) => m.user.id === user?.id && m.role === "owner") || user?.role === "admin";

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["projects", projectId] });

  const add = async () => {
    try {
      await api.addMember(projectId, email);
      setEmail("");
      toast.success("Member added");
      void refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Project members">
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {members.map((m) => (
          <li key={m.user.id} className="flex items-center gap-3 py-2.5">
            <Avatar name={m.user.full_name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.user.full_name}</p>
              <p className="truncate text-xs text-slate-500">{m.user.email}</p>
            </div>
            <span className="text-xs text-slate-500 capitalize">{m.role}</span>
            {isOwner && m.role !== "owner" && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${m.user.full_name}`}
                onClick={async () => {
                  await api.removeMember(projectId, m.user.id).catch((e) => toast.error(errorMessage(e)));
                  void refresh();
                }}
              >
                <X className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <Input type="email" required aria-label="Member email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" icon={<UserPlus className="size-4" />}>Add</Button>
        </form>
      )}
    </Modal>
  );
}

function IssueTable({ issues, onOpen }: { issues: Issue[]; onOpen: (issue: Issue) => void }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase dark:border-slate-800">
          <tr>
            {["Key", "Title", "Status", "Type", "Priority", "Assignee", "Due", "Updated"].map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {issues.map((issue) => (
            <tr key={issue.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{issue.key}</td>
              <td className="max-w-xs px-3 py-2.5">
                <button type="button" className="truncate text-left font-medium hover:text-indigo-600" onClick={() => onOpen(issue)}>
                  {issue.title}
                </button>
              </td>
              <td className="px-3 py-2.5"><StatusLabel value={issue.status} /></td>
              <td className="px-3 py-2.5"><TypeBadge value={issue.type} /></td>
              <td className="px-3 py-2.5"><PriorityBadge value={issue.priority} /></td>
              <td className="px-3 py-2.5">
                {issue.assignee ? (
                  <span className="flex items-center gap-1.5 whitespace-nowrap"><Avatar name={issue.assignee.full_name} />{issue.assignee.full_name}</span>
                ) : <span className="text-slate-400">—</span>}
              </td>
              <td className="px-3 py-2.5"><DueDate issue={issue} /></td>
              <td className="px-3 py-2.5 text-xs whitespace-nowrap text-slate-500">{timeAgo(issue.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function ProjectPage() {
  const projectId = Number(useParams().projectId);
  const [params, setParams] = useSearchParams();
  const { data: project, isError } = useProject(projectId);
  const { data: members = [] } = useMembers(projectId);
  const updateIssue = useUpdateIssue(projectId);

  // View state lives in the URL, so filters and the open issue are shareable links.
  const view = params.get("view") === "list" ? "list" : "board";
  const openIssueId = params.get("issue") ? Number(params.get("issue")) : null;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebounced(search);
  const type = (params.get("type") || undefined) as IssueType | undefined;
  const priority = (params.get("priority") || undefined) as IssuePriority | undefined;
  const assignee = params.get("assignee") ?? "";
  const sort = (params.get("sort") || "-created_at") as IssueSort;
  const page = Number(params.get("page") ?? 1);
  const [creating, setCreating] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const setParam = (key: string, value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page" && key !== "issue") next.delete("page");
      return next;
    }, { replace: key !== "issue" });

  useEffect(() => {
    if (q !== (params.get("q") ?? "")) setParam("q", q || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filters: IssueFilters = {
    q: q || undefined,
    type: type ? [type] : undefined,
    priority: priority ? [priority] : undefined,
    assignee_id: assignee && assignee !== "none" ? Number(assignee) : undefined,
    unassigned: assignee === "none",
    sort,
    // The board shows everything at once; the list paginates.
    page: view === "board" ? 1 : page,
    page_size: view === "board" ? 200 : 20,
  };
  const { data, isLoading, isFetching } = useIssues(projectId, filters);
  const hasFilters = Boolean(q || type || priority || assignee);

  const moveIssue = (issue: Issue, status: Issue["status"]) =>
    updateIssue.mutate(
      { id: issue.id, changes: { status } },
      {
        onSuccess: () => toast.success(`${issue.key} → ${STATUS[status].label}`),
        onError: (err) => toast.error(errorMessage(err, "Could not move issue")),
      },
    );

  if (isError) {
    return <EmptyState title="Project not found" description="It may have been deleted, or you're not a member." action={<Link to="/projects" className="text-indigo-600">Back to projects</Link>} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/projects" className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" aria-label="Back to projects">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{project?.name ?? "…"}</h1>
          {project?.description && <p className="truncate text-sm text-slate-500">{project.description}</p>}
        </div>
        <Button variant="secondary" onClick={() => setShowMembers(true)}>
          <span className="flex -space-x-1.5">{members.slice(0, 3).map((m) => <Avatar key={m.user.id} name={m.user.full_name} />)}</span>
          <span className="hidden sm:inline">Members</span>
        </Button>
        <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New issue</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-slate-400" aria-hidden />
          <Input aria-label="Search issues" placeholder="Search issues…" className="w-full pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select aria-label="Filter by type" className="w-auto" value={type ?? ""} onChange={(e) => setParam("type", e.target.value)}>
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Select aria-label="Filter by priority" className="w-auto" value={priority ?? ""} onChange={(e) => setParam("priority", e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
        <Select aria-label="Filter by assignee" className="w-auto" value={assignee} onChange={(e) => setParam("assignee", e.target.value)}>
          <option value="">Anyone</option>
          <option value="none">Unassigned</option>
          {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.full_name}</option>)}
        </Select>
        {view === "list" && (
          <Select aria-label="Sort by" className="w-auto" value={sort} onChange={(e) => setParam("sort", e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        )}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setParams(view === "list" ? { view } : {}); }}>
            Clear filters
          </Button>
        )}
        <div className="ml-auto flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800" role="group" aria-label="View">
          {([["board", Columns3, "Board"], ["list", List, "List"]] as const).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setParam("view", value === "board" ? null : value)}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm",
                view === value ? "bg-white shadow-sm dark:bg-slate-700" : "text-slate-500",
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Spinner label="Loading issues" />
      ) : !data?.items.length ? (
        <EmptyState
          title={hasFilters ? "No issues match these filters" : "No issues yet"}
          action={!hasFilters && <Button onClick={() => setCreating(true)}>Create the first issue</Button>}
        />
      ) : view === "board" ? (
        <KanbanBoard issues={data.items} onOpen={(i) => setParam("issue", String(i.id))} onMove={moveIssue} />
      ) : (
        <div className={clsx("space-y-3 transition-opacity", isFetching && "opacity-60")}>
          <IssueTable issues={data.items} onOpen={(i) => setParam("issue", String(i.id))} />
          <nav className="flex items-center justify-between text-sm text-slate-500" aria-label="Pagination">
            <span>{data.total} issues</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>Previous</Button>
              <span>Page {data.page} of {Math.max(data.pages, 1)}</span>
              <Button variant="secondary" size="sm" disabled={page >= data.pages} onClick={() => setParam("page", String(page + 1))}>Next</Button>
            </div>
          </nav>
        </div>
      )}

      <CreateIssueModal projectId={projectId} open={creating} onClose={() => setCreating(false)} />
      <MembersModal projectId={projectId} open={showMembers} onClose={() => setShowMembers(false)} />
      <IssueDetailModal issueId={openIssueId} onClose={() => setParam("issue", null)} />
    </div>
  );
}
