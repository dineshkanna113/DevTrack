import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button, Card, EmptyState, Field, Input, Modal, Spinner, Textarea } from "@/components/ui";
import { keys, useProjects } from "@/hooks/queries";
import { api, errorMessage } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/, "2–10 letters/digits, starting with a letter"),
  description: z.string().max(2000),
});
type FormValues = z.infer<typeof schema>;

function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", key: "", description: "" },
  });
  const { errors } = form.formState;

  const create = useMutation({
    mutationFn: api.createProject,
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: keys.projects });
      toast.success(`Created ${project.name}`);
      form.reset();
      onClose();
      navigate(`/projects/${project.id}`);
    },
    onError: (err) => form.setError("key", { message: errorMessage(err) }),
  });

  // Suggest a key from the name until the user edits the key themselves
  const suggestKey = (name: string) => {
    if (form.getFieldState("key").isDirty) return;
    const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
    const key = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 4);
    form.setValue("key", key.slice(0, 10));
  };

  return (
    <Modal open={open} onClose={onClose} title="New project">
      <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4" noValidate>
        <Field label="Name" error={errors.name?.message}>
          {(id, d) => (
            <Input id={id} aria-describedby={d} autoFocus {...form.register("name", { onChange: (e) => suggestKey(e.target.value) })} />
          )}
        </Field>
        <Field label="Key" error={errors.key?.message}>
          {(id, d) => <Input id={id} aria-describedby={d} className="font-mono uppercase" placeholder="WEB" {...form.register("key")} />}
        </Field>
        <Field label="Description">
          {(id) => <Textarea id={id} rows={3} {...form.register("description")} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={create.isPending}>Create project</Button>
        </div>
      </form>
    </Modal>
  );
}

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
          New project
        </Button>
      </div>

      {isLoading ? (
        <Spinner label="Loading projects" />
      ) : !projects?.length ? (
        <EmptyState
          title="No projects yet"
          description="Create a project to start tracking issues."
          action={<Button onClick={() => setCreating(true)}>Create your first project</Button>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const done = p.total_issues - p.open_issues;
            const pct = p.total_issues ? Math.round((done / p.total_issues) * 100) : 0;
            return (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="block h-full">
                  <Card className="h-full p-5 transition-shadow hover:shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                        {p.key}
                      </span>
                      <h2 className="truncate font-semibold">{p.name}</h2>
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-500">{p.description || "No description"}</p>
                    <div className="mt-4 flex justify-between text-xs text-slate-500">
                      <span>{p.open_issues} open · {p.total_issues} total</span>
                      <span>{pct}% done</span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                      role="progressbar"
                      aria-label={`${p.name} completion`}
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <CreateProjectModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
