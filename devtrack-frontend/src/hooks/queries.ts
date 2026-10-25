import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Issue, IssueCreate, IssueFilters, IssuePage, IssueUpdate } from "@/lib/types";

export const keys = {
  projects: ["projects"] as const,
  project: (id: number) => ["projects", id] as const,
  members: (id: number) => ["projects", id, "members"] as const,
  stats: (id: number) => ["projects", id, "stats"] as const,
  issues: (projectId: number, filters?: IssueFilters) =>
    filters ? (["issues", projectId, filters] as const) : (["issues", projectId] as const),
  issue: (id: number) => ["issue", id] as const,
  comments: (id: number) => ["issue", id, "comments"] as const,
  activity: (id: number) => ["issue", id, "activity"] as const,
  myIssues: ["my-issues"] as const,
  health: ["health"] as const,
};

export const useHealth = () =>
  useQuery({ queryKey: keys.health, queryFn: api.health, staleTime: 60_000, retry: false });

export const useProjects = () => useQuery({ queryKey: keys.projects, queryFn: api.projects });

export const useProject = (id: number) =>
  useQuery({ queryKey: keys.project(id), queryFn: () => api.project(id) });

export const useMembers = (projectId: number) =>
  useQuery({ queryKey: keys.members(projectId), queryFn: () => api.members(projectId) });

export const useStats = (projectId: number | undefined) =>
  useQuery({
    queryKey: keys.stats(projectId ?? 0),
    queryFn: () => api.stats(projectId!),
    enabled: projectId !== undefined,
  });

export const useIssues = (projectId: number, filters: IssueFilters) =>
  useQuery({
    queryKey: keys.issues(projectId, filters),
    queryFn: () => api.issues(projectId, filters),
    placeholderData: keepPreviousData,
  });

export const useMyIssues = () => useQuery({ queryKey: keys.myIssues, queryFn: api.myIssues });

export const useIssue = (id: number | null) =>
  useQuery({ queryKey: keys.issue(id ?? 0), queryFn: () => api.issue(id!), enabled: id !== null });

export const useComments = (issueId: number) =>
  useQuery({ queryKey: keys.comments(issueId), queryFn: () => api.comments(issueId) });

export const useActivity = (issueId: number) =>
  useQuery({ queryKey: keys.activity(issueId), queryFn: () => api.activity(issueId) });

/** Anything that changes issues invalidates lists, stats and project counts. */
function useInvalidateIssues() {
  const queryClient = useQueryClient();
  return (projectId: number, issueId?: number) => {
    void queryClient.invalidateQueries({ queryKey: keys.issues(projectId) });
    void queryClient.invalidateQueries({ queryKey: keys.projects });
    void queryClient.invalidateQueries({ queryKey: keys.myIssues });
    if (issueId) void queryClient.invalidateQueries({ queryKey: keys.issue(issueId) });
  };
}

export function useCreateIssue(projectId: number) {
  const invalidate = useInvalidateIssues();
  return useMutation({
    mutationFn: (body: IssueCreate) => api.createIssue(projectId, body),
    onSuccess: () => invalidate(projectId),
  });
}

/**
 * Optimistic update: the Kanban card moves immediately and rolls back if the API rejects it.
 */
export function useUpdateIssue(projectId: number) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateIssues();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: IssueUpdate }) =>
      api.updateIssue(id, changes),
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: keys.issues(projectId) });
      const snapshots = queryClient.getQueriesData<IssuePage>({ queryKey: keys.issues(projectId) });
      const optimistic = { ...changes } as Partial<Issue>;
      delete (optimistic as { assignee_id?: unknown }).assignee_id;
      for (const [key, page] of snapshots) {
        if (!page) continue;
        queryClient.setQueryData<IssuePage>(key, {
          ...page,
          items: page.items.map((issue) => (issue.id === id ? { ...issue, ...optimistic } : issue)),
        });
      }
      return { snapshots };
    },
    onError: (_error, _vars, context) => {
      context?.snapshots.forEach(([key, page]) => queryClient.setQueryData(key, page));
    },
    onSuccess: (issue) => {
      queryClient.setQueryData(keys.issue(issue.id), issue);
      void queryClient.invalidateQueries({ queryKey: keys.activity(issue.id) });
    },
    onSettled: (_data, _error, { id }) => invalidate(projectId, id),
  });
}

export function useDeleteIssue(projectId: number) {
  const invalidate = useInvalidateIssues();
  return useMutation({
    mutationFn: (id: number) => api.deleteIssue(id),
    onSuccess: () => invalidate(projectId),
  });
}

export function useAddComment(issueId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.addComment(issueId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.comments(issueId) });
      void queryClient.invalidateQueries({ queryKey: keys.activity(issueId) });
    },
  });
}
