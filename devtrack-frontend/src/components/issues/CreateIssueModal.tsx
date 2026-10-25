import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useCreateIssue, useHealth, useMembers } from "@/hooks/queries";
import { api, errorMessage } from "@/lib/api";
import { PRIORITIES, PRIORITY, TYPE, TYPES } from "@/lib/constants";
import type { Issue, TriageResponse } from "@/lib/types";
import { Button, Field, Input, Modal, Select, Textarea } from "../ui";

const schema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(200),
  description: z.string().max(10_000),
  type: z.enum(["bug", "feature", "task", "improvement"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  assignee_id: z.string(),
  due_date: z.string(),
});
type FormValues = z.infer<typeof schema>;

const defaults: FormValues = {
  title: "",
  description: "",
  type: "task",
  priority: "medium",
  assignee_id: "",
  due_date: "",
};

export function CreateIssueModal({
  projectId,
  open,
  onClose,
  onCreated,
}: {
  projectId: number;
  open: boolean;
  onClose: () => void;
  onCreated?: (issue: Issue) => void;
}) {
  const { data: members = [] } = useMembers(projectId);
  const { data: health } = useHealth();
  const createIssue = useCreateIssue(projectId);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { errors } = form.formState;

  const triage = useMutation({
    mutationFn: () => api.triage(projectId, form.getValues("title"), form.getValues("description")),
    onError: (err) => toast.error(errorMessage(err, "AI triage failed")),
  });

  const applySuggestion = (s: TriageResponse) => {
    form.setValue("type", s.type);
    form.setValue("priority", s.priority);
    form.setValue("title", s.suggested_title, { shouldValidate: true });
    toast.success("Applied AI suggestions");
  };

  const close = () => {
    form.reset(defaults);
    triage.reset();
    onClose();
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const issue = await createIssue.mutateAsync({
        title: values.title,
        description: values.description,
        type: values.type,
        priority: values.priority,
        assignee_id: values.assignee_id ? Number(values.assignee_id) : null,
        due_date: values.due_date || null,
      });
      toast.success(`Created ${issue.key}`);
      onCreated?.(issue);
      close();
    } catch (err) {
      toast.error(errorMessage(err, "Could not create issue"));
    }
  });

  const suggestion = triage.data;
  const canTriage = health?.ai_enabled && form.watch("title").trim().length >= 3;

  return (
    <Modal open={open} onClose={close} title="New issue" wide>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Title" error={errors.title?.message}>
          {(id, d) => <Input id={id} autoFocus aria-describedby={d} placeholder="e.g. Login fails on Safari" {...form.register("title")} />}
        </Field>
        <Field label="Description" error={errors.description?.message}>
          {(id, d) => <Textarea id={id} aria-describedby={d} rows={5} placeholder="Steps to reproduce, expected vs actual behavior…" {...form.register("description")} />}
        </Field>

        {health?.ai_enabled && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-500/30 dark:bg-violet-500/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-violet-900 dark:text-violet-200">
                Let Claude suggest a type, priority and cleaner title, and check for duplicates.
              </p>
              <Button
                variant="ai"
                size="sm"
                icon={<Sparkles className="size-4" />}
                loading={triage.isPending}
                disabled={!canTriage}
                onClick={() => triage.mutate()}
              >
                {triage.isPending ? "Analyzing…" : "Triage with AI"}
              </Button>
            </div>
            {suggestion && (
              <div className="mt-3 space-y-2 border-t border-violet-200 pt-3 text-sm dark:border-violet-500/30" aria-live="polite">
                <p>
                  <span className="font-medium">{suggestion.suggested_title}</span>
                  <span className="text-slate-500"> · {TYPE[suggestion.type].label} · {PRIORITY[suggestion.priority].label} priority</span>
                </p>
                <p className="text-slate-600 dark:text-slate-300">{suggestion.summary}</p>
                <p className="text-xs text-slate-500">{suggestion.reasoning}</p>
                {suggestion.duplicates.length > 0 && (
                  <div className="rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                    <p className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="size-4" aria-hidden /> Possible duplicates
                    </p>
                    <ul className="mt-1 list-inside list-disc">
                      {suggestion.duplicates.map((d) => (
                        <li key={d.id}>
                          <span className="font-mono text-xs">{d.key}</span> {d.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button size="sm" variant="secondary" onClick={() => applySuggestion(suggestion)}>
                  Apply suggestions
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            {(id) => (
              <Select id={id} {...form.register("type")}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Priority">
            {(id) => (
              <Select id={id} {...form.register("priority")}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Assignee">
            {(id) => (
              <Select id={id} {...form.register("assignee_id")}>
                <option value="">Unassigned</option>
                {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.full_name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Due date">
            {(id) => <Input id={id} type="date" {...form.register("due_date")} />}
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" loading={createIssue.isPending}>Create issue</Button>
        </div>
      </form>
    </Modal>
  );
}
