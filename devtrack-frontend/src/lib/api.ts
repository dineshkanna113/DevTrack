import axios, { AxiosError } from "axios";
import type {
  Activity,
  Comment,
  Health,
  Issue,
  IssueCreate,
  IssueFilters,
  IssuePage,
  IssueUpdate,
  Member,
  Project,
  ProjectRole,
  ProjectStats,
  TriageResponse,
  User,
} from "./types";

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const TOKEN_KEY = "devtrack.token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const http = axios.create({ baseURL: `${API_URL}/api/v1`, timeout: 30_000 });

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized: (() => void) | null = null;
/** Lets the auth provider react to expired sessions from any request. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

/** Turn any API error into a human-readable message. */
export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { loc?: string[]; msg?: string };
      const field = first.loc?.at(-1);
      return field ? `${field}: ${first.msg}` : (first.msg ?? fallback);
    }
    if (error.code === "ECONNABORTED") return "The server took too long to respond";
    if (!error.response) return "Cannot reach the server";
  }
  return fallback;
}

// Serialize arrays as repeated params (?status=todo&status=done), which FastAPI expects.
function toParams(filters: IssueFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "" || value === false) continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.set(key, String(value));
  }
  return params;
}

const data = <T>(promise: Promise<{ data: T }>) => promise.then((r) => r.data);

export const api = {
  health: () => data<Health>(axios.get(`${API_URL}/health`)),

  login: (email: string, password: string) =>
    data<{ access_token: string }>(
      http.post("/auth/login", new URLSearchParams({ username: email, password })),
    ),
  register: (body: { email: string; full_name: string; password: string }) =>
    data<User>(http.post("/auth/register", body)),
  me: () => data<User>(http.get("/auth/me")),

  projects: () => data<Project[]>(http.get("/projects")),
  project: (id: number) => data<Project>(http.get(`/projects/${id}`)),
  createProject: (body: { key: string; name: string; description?: string }) =>
    data<Project>(http.post("/projects", body)),
  deleteProject: (id: number) => http.delete(`/projects/${id}`),
  members: (projectId: number) => data<Member[]>(http.get(`/projects/${projectId}/members`)),
  addMember: (projectId: number, email: string, role: ProjectRole = "member") =>
    data<Member>(http.post(`/projects/${projectId}/members`, { email, role })),
  removeMember: (projectId: number, userId: number) =>
    http.delete(`/projects/${projectId}/members/${userId}`),
  stats: (projectId: number) => data<ProjectStats>(http.get(`/projects/${projectId}/stats`)),

  issues: (projectId: number, filters: IssueFilters = {}) =>
    data<IssuePage>(http.get(`/projects/${projectId}/issues`, { params: toParams(filters) })),
  myIssues: () => data<Issue[]>(http.get("/issues/assigned-to-me")),
  issue: (id: number) => data<Issue>(http.get(`/issues/${id}`)),
  createIssue: (projectId: number, body: IssueCreate) =>
    data<Issue>(http.post(`/projects/${projectId}/issues`, body)),
  updateIssue: (id: number, body: IssueUpdate) => data<Issue>(http.patch(`/issues/${id}`, body)),
  deleteIssue: (id: number) => http.delete(`/issues/${id}`),

  comments: (issueId: number) => data<Comment[]>(http.get(`/issues/${issueId}/comments`)),
  addComment: (issueId: number, body: string) =>
    data<Comment>(http.post(`/issues/${issueId}/comments`, { body })),
  deleteComment: (id: number) => http.delete(`/comments/${id}`),
  activity: (issueId: number) => data<Activity[]>(http.get(`/issues/${issueId}/activity`)),

  triage: (projectId: number, title: string, description: string) =>
    data<TriageResponse>(
      http.post(`/projects/${projectId}/ai/triage`, { title, description }, { timeout: 90_000 }),
    ),
};
