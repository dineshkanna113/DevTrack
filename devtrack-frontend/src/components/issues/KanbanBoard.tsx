import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import clsx from "clsx";
import { useState } from "react";
import { STATUSES } from "@/lib/constants";
import type { Issue, IssueStatus } from "@/lib/types";
import { Avatar } from "../ui";
import { DueDate, PriorityBadge, TypeBadge } from "./IssueBadges";

interface Props {
  issues: Issue[];
  onOpen: (issue: Issue) => void;
  onMove: (issue: Issue, status: IssueStatus) => void;
}

export function IssueCard({ issue, onOpen, dragging = false }: { issue: Issue; onOpen?: () => void; dragging?: boolean }) {
  return (
    <article
      className={clsx(
        "rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800",
        dragging && "rotate-1 shadow-lg ring-indigo-400",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left text-sm font-medium hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <span className="mr-1.5 font-mono text-xs text-slate-500">{issue.key}</span>
        {issue.title}
      </button>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <TypeBadge value={issue.type} />
        <PriorityBadge value={issue.priority} />
        <DueDate issue={issue} />
        <span className="ml-auto">
          {issue.assignee ? <Avatar name={issue.assignee.full_name} /> : null}
        </span>
      </div>
    </article>
  );
}

function DraggableCard({ issue, onOpen }: { issue: Issue; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
    data: { issue },
  });
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // dnd-kit defaults to role="button"; keep list semantics so the inner title stays the only button
      role="listitem"
      aria-roledescription="Draggable issue"
      aria-label={`${issue.key}: ${issue.title}`}
      className={clsx("cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <IssueCard issue={issue} onOpen={onOpen} />
    </li>
  );
}

function Column({ status, label, dot, issues, onOpen }: {
  status: IssueStatus;
  label: string;
  dot: string;
  issues: Issue[];
  onOpen: (issue: Issue) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${label} column`}
      className={clsx(
        "flex min-h-64 w-72 shrink-0 flex-col rounded-xl bg-slate-100/80 p-2 transition-colors md:w-auto dark:bg-slate-900/50",
        isOver && "bg-indigo-50 ring-2 ring-indigo-300 dark:bg-indigo-500/10",
      )}
    >
      <h3 className="flex items-center gap-2 px-1.5 py-2 text-sm font-semibold">
        <span className={clsx("size-2 rounded-full", dot)} aria-hidden />
        {label}
        <span className="ml-auto rounded-full bg-white px-2 text-xs font-medium text-slate-500 dark:bg-slate-800">
          {issues.length}
        </span>
      </h3>
      <ul className="flex flex-1 flex-col gap-2">
        {issues.map((issue) => (
          <DraggableCard key={issue.id} issue={issue} onOpen={() => onOpen(issue)} />
        ))}
      </ul>
    </section>
  );
}

export function KanbanBoard({ issues, onOpen, onMove }: Props) {
  const [active, setActive] = useState<Issue | null>(null);
  const sensors = useSensors(
    // A small distance threshold keeps plain clicks working as "open issue"
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    setActive(null);
    const issue = dragged.data.current?.issue as Issue | undefined;
    const target = over?.id as IssueStatus | undefined;
    if (issue && target && issue.status !== target) onMove(issue, target);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active: a }) => setActive((a.data.current?.issue as Issue) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:px-0">
        {STATUSES.map((s) => (
          <Column
            key={s.value}
            status={s.value}
            label={s.label}
            dot={s.dot}
            issues={issues.filter((i) => i.status === s.value)}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>{active ? <IssueCard issue={active} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
