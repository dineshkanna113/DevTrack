import { Pencil, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  useActivity,
  useAddComment,
  useComments,
  useDeleteIssue,
  useIssue,
  useMembers,
  useUpdateIssue,
} from "@/hooks/queries";
import { errorMessage } from "@/lib/api";
import { PRIORITIES, STATUS, STATUSES, TYPES } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/format";
import type { Activity, Issue, IssueUpdate } from "@/lib/types";
import { Avatar, Button, Field, Input, Modal, Select, Spinner, Textarea } from "../ui";
import { DueDate, PriorityBadge, TypeBadge } from "./IssueBadges";

function describe(a: Activity): string {
  if (a.action === "created") return "created this issue";
  if (a.action === "commented") return "commented";
  if (a.field === "description") return "edited the description";
  const fmt = (v: string | null) => {
    if (v === null) return "none";
    return a.field === "status" ? (STATUS[v as Issue["status"]]?.label ?? v) : v;
  };
  return `changed ${a.field?.replace("_", " ")} from ${fmt(a.old_value)} to ${fmt(a.new_value)}`;
}

function EditableText({ issue, onSave, saving }: {
  issue: Issue;
  onSave: (changes: IssueUpdate) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description);

  if (!editing) {
    return (
      <div className="group">
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-lg font-semibold">{issue.title}</h3>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label="Edit title and description">
            <Pencil className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300">
          {issue.description || <span className="italic text-slate-400">No description</span>}
        </p>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await onSave({ title, description });
    setEditing(false);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Title">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} minLength={3} maxLength={200} required />}</Field>
      <Field label="Description">{(id) => <Textarea id={id} rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        <Button type="submit" size="sm" loading={saving}>Save</Button>
      </div>
    </form>
  );
}

function IssueBody({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const { data: members = [] } = useMembers(issue.project_id);
  const { data: comments } = useComments(issue.id);
  const { data: activity } = useActivity(issue.id);
  const update = useUpdateIssue(issue.project_id);
  const remove = useDeleteIssue(issue.project_id);
  const addComment = useAddComment(issue.id);
  const [comment, setComment] = useState("");

  const save = async (changes: IssueUpdate) => {
    try {
      await update.mutateAsync({ id: issue.id, changes });
    } catch (err) {
      toast.error(errorMessage(err, "Update failed"));
      throw err;
    }
  };

  const submitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await addComment.mutateAsync(comment);
      setComment("");
    } catch (err) {
      toast.error(errorMessage(err, "Could not post comment"));
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete ${issue.key}? This cannot be undone.`)) return;
    try {
      await remove.mutateAsync(issue.id);
      toast.success(`Deleted ${issue.key}`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete issue"));
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_220px]">
      <div className="min-w-0 space-y-6">
        <EditableText key={issue.updated_at} issue={issue} onSave={save} saving={update.isPending} />

        <section aria-labelledby="comments-heading">
          <h4 id="comments-heading" className="mb-3 text-sm font-semibold">Comments</h4>
          {comments === undefined ? <Spinner /> : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar name={c.author?.full_name ?? "?"} size="md" />
                  <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{c.author?.full_name ?? "Deleted user"}</span>
                      {" · "}{timeAgo(c.created_at)}
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
                  </div>
                </li>
              ))}
              {comments.length === 0 && <li className="text-sm text-slate-500">No comments yet.</li>}
            </ul>
          )}
          <form onSubmit={submitComment} className="mt-3 space-y-2">
            <Textarea aria-label="Add a comment" rows={2} className="min-h-0" placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={addComment.isPending} disabled={!comment.trim()}>Comment</Button>
            </div>
          </form>
        </section>

        <section aria-labelledby="activity-heading">
          <h4 id="activity-heading" className="mb-3 text-sm font-semibold">Activity</h4>
          <ol className="space-y-2 border-l border-slate-200 pl-4 dark:border-slate-800">
            {activity?.map((a) => (
              <li key={a.id} className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-200">{a.actor?.full_name ?? "Someone"}</span>{" "}
                {describe(a)} <span className="text-xs text-slate-400">· {timeAgo(a.created_at)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="space-y-4 text-sm">
        <Field label="Status">
          {(id) => (
            <Select id={id} value={issue.status} onChange={(e) => void save({ status: e.target.value as Issue["status"] })}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Priority">
          {(id) => (
            <Select id={id} value={issue.priority} onChange={(e) => void save({ priority: e.target.value as Issue["priority"] })}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Type">
          {(id) => (
            <Select id={id} value={issue.type} onChange={(e) => void save({ type: e.target.value as Issue["type"] })}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Assignee">
          {(id) => (
            <Select id={id} value={issue.assignee?.id ?? ""} onChange={(e) => void save({ assignee_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.full_name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Due date">
          {(id) => <Input id={id} type="date" value={issue.due_date ?? ""} onChange={(e) => void save({ due_date: e.target.value || null })} />}
        </Field>
        <dl className="space-y-1 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800">
          <div><dt className="inline">Reporter: </dt><dd className="inline">{issue.reporter?.full_name ?? "—"}</dd></div>
          <div><dt className="inline">Created: </dt><dd className="inline">{formatDate(issue.created_at)}</dd></div>
          <div><dt className="inline">Updated: </dt><dd className="inline">{timeAgo(issue.updated_at)}</dd></div>
          {issue.resolved_at && <div><dt className="inline">Resolved: </dt><dd className="inline">{formatDate(issue.resolved_at)}</dd></div>}
        </dl>
        <Button variant="ghost" size="sm" className="w-full text-red-600 dark:text-red-400" icon={<Trash2 className="size-4" />} onClick={onDelete} loading={remove.isPending}>
          Delete issue
        </Button>
      </aside>
    </div>
  );
}

export function IssueDetailModal({ issueId, onClose }: { issueId: number | null; onClose: () => void }) {
  const { data: issue, isError } = useIssue(issueId);
  const title = issue ? `${issue.key}` : "Issue";

  return (
    <Modal open={issueId !== null} onClose={onClose} title={title} wide>
      {isError ? (
        <p className="text-sm text-slate-500">This issue doesn't exist or you no longer have access.</p>
      ) : !issue ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <TypeBadge value={issue.type} />
            <PriorityBadge value={issue.priority} />
            <DueDate issue={issue} />
          </div>
          <IssueBody issue={issue} onClose={onClose} />
        </>
      )}
    </Modal>
  );
}
