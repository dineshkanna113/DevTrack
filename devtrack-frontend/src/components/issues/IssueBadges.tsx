import clsx from "clsx";
import { Bug, CalendarClock, CheckSquare, Sparkles, Wrench } from "lucide-react";
import { PRIORITY, STATUS, TYPE } from "@/lib/constants";
import { formatDate, isOverdue } from "@/lib/format";
import type { Issue, IssuePriority, IssueStatus, IssueType } from "@/lib/types";
import { Badge } from "../ui";

const TYPE_ICON = { bug: Bug, feature: Sparkles, improvement: Wrench, task: CheckSquare } as const;

export const PriorityBadge = ({ value }: { value: IssuePriority }) => (
  <Badge className={PRIORITY[value].badge}>{PRIORITY[value].label}</Badge>
);

export const TypeBadge = ({ value }: { value: IssueType }) => {
  const Icon = TYPE_ICON[value];
  return (
    <Badge className={TYPE[value].badge}>
      <Icon className="size-3" aria-hidden />
      {TYPE[value].label}
    </Badge>
  );
};

export const StatusLabel = ({ value }: { value: IssueStatus }) => (
  <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
    <span className={clsx("size-2 rounded-full", STATUS[value].dot)} aria-hidden />
    {STATUS[value].label}
  </span>
);

/** Three slanted bars in the status colour, used as a column and section marker. */
export function StatusMarker({ className }: { className: string }) {
  return (
    <span className={clsx("flex h-6 w-1 shrink-0 flex-col gap-0.5", className)} aria-hidden>
      {[0, 1, 2].map((s) => (
        <span key={s} className="marker-segment h-[7px] w-full bg-current" />
      ))}
    </span>
  );
}

export function DueDate({ issue }: { issue: Pick<Issue, "due_date" | "status"> }) {
  if (!issue.due_date) return null;
  const overdue = isOverdue(issue.due_date, issue.status);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 text-xs",
        overdue ? "font-medium text-red-600 dark:text-red-400" : "text-ink-muted",
      )}
    >
      <CalendarClock className="size-3.5" aria-hidden />
      {overdue && <span className="sr-only">Overdue:</span>}
      {formatDate(issue.due_date)}
    </span>
  );
}
