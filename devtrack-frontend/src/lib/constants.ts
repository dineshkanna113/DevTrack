import type { IssuePriority, IssueStatus, IssueType } from "./types";

export const STATUSES: { value: IssueStatus; label: string; dot: string }[] = [
  { value: "todo", label: "To do", dot: "bg-slate-400" },
  { value: "in_progress", label: "In progress", dot: "bg-blue-500" },
  { value: "in_review", label: "In review", dot: "bg-amber-500" },
  { value: "done", label: "Done", dot: "bg-emerald-500" },
];

export const PRIORITIES: { value: IssuePriority; label: string; badge: string }[] = [
  { value: "critical", label: "Critical", badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  { value: "high", label: "High", badge: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  { value: "medium", label: "Medium", badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-200" },
  { value: "low", label: "Low", badge: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
];

export const TYPES: { value: IssueType; label: string; badge: string }[] = [
  { value: "bug", label: "Bug", badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  { value: "feature", label: "Feature", badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  { value: "improvement", label: "Improvement", badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { value: "task", label: "Task", badge: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300" },
];

const byValue = <T extends { value: string }>(items: T[]) =>
  Object.fromEntries(items.map((item) => [item.value, item])) as Record<T["value"], T>;

export const STATUS = byValue(STATUSES);
export const PRIORITY = byValue(PRIORITIES);
export const TYPE = byValue(TYPES);

/** Public demo login created by `python -m app.seed`. */
export const DEMO_ACCOUNT = { email: "demo@devtrack.dev", password: "DemoPass123!" };
