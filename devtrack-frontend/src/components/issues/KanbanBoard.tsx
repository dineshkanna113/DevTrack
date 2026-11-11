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
import { DueDate, PriorityBadge, StatusMarker, TypeBadge } from "./IssueBadges";

interface Props {
  issues: Issue[];
  onOpen: (issue: Issue) => void;
  onMove: (issue: Issue, status: IssueStatus) => void;
}

export function IssueCard({ issue, onOpen, dragging = false }: { issue: Issue; onOpen?: () => void; dragging?: boolean }) {
  return (
    <article
      className={clsx(
        "group rounded-xl border border-line bg-surface transition-[box-shadow,border-color] hover:border-ink-faint/40 hover:shadow-sm",
        dragging && "rotate-[1.5deg] border-brand shadow-xl shadow-brand/10",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <span className="font-mono text-[11px] font-semibold tracking-wide text-ink-faint">{issue.key}</span>
        <PriorityBadge value={issue.priority} />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="block w-full px-3.5 pt-1.5 pb-3 text-left text-sm leading-snug font-medium text-ink group-hover:text-brand-ink"
      >
        {issue.title}
      </button>
      <div className="flex min-h-10 items-center gap-2 border-t border-line px-3.5 py-2">
        <TypeBadge value={issue.type} />
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
      className={clsx("cursor-grab touch-none rounded-xl active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <IssueCard issue={issue} onOpen={onOpen} />
    </li>
  );
}

function Column({ status, label, accent, chip, issues, onOpen }: {
  status: IssueStatus;
  label: string;
  accent: string;
  chip: string;
  issues: Issue[];
  onOpen: (issue: Issue) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${label} column`}
      className={clsx(
        "flex min-h-72 w-[18.5rem] shrink-0 flex-col rounded-2xl bg-sunken p-1 pt-3 transition-colors md:w-auto",
        isOver && "bg-brand-soft ring-2 ring-brand/40",
      )}
    >
      <h3 className="mb-2 flex h-7 items-center gap-2 pr-2 pl-2.5 text-sm font-semibold">
        <StatusMarker className={accent} />
        {label}
        <span className={clsx("ml-auto grid h-6 min-w-6 place-items-center rounded-lg px-1.5 text-xs font-medium", chip)}>
          {issues.length}
        </span>
      </h3>
      <ul className="flex flex-col gap-1.5">
        {issues.map((issue) => (
          <DraggableCard key={issue.id} issue={issue} onOpen={() => onOpen(issue)} />
        ))}
      </ul>
      {issues.length === 0 && (
        <p className="m-0.5 flex h-28 items-center justify-center rounded-xl border border-dashed border-line text-xs text-ink-faint">
          Drop issues here
        </p>
      )}
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
      <div className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:px-0">
        {STATUSES.map((s) => (
          <Column
            key={s.value}
            status={s.value}
            label={s.label}
            accent={s.accent}
            chip={s.chip}
            issues={issues.filter((i) => i.status === s.value)}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>{active ? <IssueCard issue={active} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
