// Mirrors the Pydantic schemas in devtrack-backend/app/schemas.py

export type IssueStatus = "todo" | "in_progress" | "in_review" | "done";
export type IssuePriority = "low" | "medium" | "high" | "critical";
export type IssueType = "bug" | "feature" | "task" | "improvement";
export type ProjectRole = "owner" | "member";

export interface UserBrief {
  id: number;
  email: string;
  full_name: string;
}

export interface User extends UserBrief {
  role: "admin" | "member";
  created_at: string;
}

export interface Project {
  id: number;
  key: string;
  name: string;
  description: string;
  owner: UserBrief;
  created_at: string;
  open_issues: number;
  total_issues: number;
}

export interface Member {
  user: UserBrief;
  role: ProjectRole;
  joined_at: string;
}

export interface Issue {
  id: number;
  key: string;
  number: number;
  project_id: number;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  reporter: UserBrief | null;
  assignee: UserBrief | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface IssuePage {
  items: Issue[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface IssueCreate {
  title: string;
  description?: string;
  priority?: IssuePriority;
  type?: IssueType;
  assignee_id?: number | null;
  due_date?: string | null;
}

export type IssueUpdate = Partial<IssueCreate & { status: IssueStatus }>;

export type IssueSort =
  | "-created_at"
  | "created_at"
  | "-updated_at"
  | "-priority"
  | "priority"
  | "due_date"
  | "number";

export interface IssueFilters {
  status?: IssueStatus[];
  priority?: IssuePriority[];
  type?: IssueType[];
  assignee_id?: number;
  unassigned?: boolean;
  q?: string;
  sort?: IssueSort;
  page?: number;
  page_size?: number;
}

export interface Comment {
  id: number;
  issue_id: number;
  author: UserBrief | null;
  body: string;
  created_at: string;
}

export interface Activity {
  id: number;
  actor: UserBrief | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface ProjectStats {
  total: number;
  open: number;
  done: number;
  overdue: number;
  by_status: Record<IssueStatus, number>;
  by_priority: Record<IssuePriority, number>;
  by_type: Record<IssueType, number>;
  open_by_assignee: { user: UserBrief | null; count: number }[];
  daily: { date: string; created: number; resolved: number }[];
}

export interface TriageResponse {
  type: IssueType;
  priority: IssuePriority;
  suggested_title: string;
  summary: string;
  reasoning: string;
  duplicates: { id: number; key: string; title: string }[];
}

export interface Health {
  status: string;
  database: string;
  ai_enabled: boolean;
  version: string;
}
