import clsx from "clsx";
import { CalendarClock } from "lucide-react";
import { PRIORITY, STATUS, TYPE } from "@/lib/constants";
import { formatDate, isOverdue } from "@/lib/format";
import type { Issue, IssuePriority, IssueStatus, IssueType } from "@/lib/types";
import { Badge } from "../ui";

export const PriorityBadge = ({ value }: { value: IssuePriority }) => (
  <Badge className={PRIORITY[value].badge}>{PRIORITY[value].label}</Badge>
);

export const TypeBadge = ({ value }: { value: IssueType }) => (
  <Badge className={TYPE[value].badge}>{TYPE[value].label}</Badge>
);

export const StatusLabel = ({ value }: { value: IssueStatus }) => (
  <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
    <span className={clsx("size-2 rounded-full", STATUS[value].dot)} aria-hidden />
    {STATUS[value].label}
  </span>
);

export function DueDate({ issue }: { issue: Pick<Issue, "due_date" | "status"> }) {
  if (!issue.due_date) return null;
  const overdue = isOverdue(issue.due_date, issue.status);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 text-xs",
        overdue ? "font-medium text-red-600 dark:text-red-400" : "text-slate-500",
      )}
    >
      <CalendarClock className="size-3.5" aria-hidden />
      {overdue && <span className="sr-only">Overdue:</span>}
      {formatDate(issue.due_date)}
    </span>
  );
}
