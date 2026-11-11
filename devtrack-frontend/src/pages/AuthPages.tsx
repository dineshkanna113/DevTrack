import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart3, Columns3, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/auth/AuthContext";
import { Logo } from "@/components/Layout";
import { Button, Field, Input } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { DEMO_ACCOUNT as DEMO } from "@/lib/constants";


const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z
  .object({
    full_name: z.string().trim().min(1, "Name is required").max(100),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

const HIGHLIGHTS = [
  { icon: Columns3, title: "Kanban that keeps up", text: "Drag issues between columns; the board updates instantly." },
  { icon: Sparkles, title: "AI triage", text: "Claude suggests type, priority and possible duplicates." },
  { icon: BarChart3, title: "Live analytics", text: "Open, done and overdue at a glance, per project." },
];

// Decorative mini board for the sign-in panel. Hidden from assistive tech.
const PREVIEW = [
  { label: "To do", tone: "text-slate-400", cards: ["Rate-limit login", "Export to CSV"] },
  { label: "In progress", tone: "text-blue-400", cards: ["AI triage v2"] },
  { label: "Done", tone: "text-emerald-400", cards: ["Dark mode"] },
];

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#0d0e11] p-10 text-white lg:flex lg:flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 size-[34rem] rounded-full bg-indigo-600/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-40 size-[28rem] rounded-full bg-violet-600/20 blur-3xl"
      />
      <Logo className="relative [&_span_span]:text-indigo-300" />
      <div className="relative mt-auto max-w-md">
        <h2 className="text-4xl leading-tight font-semibold tracking-tight">
          Track every issue from report to resolved.
        </h2>
        <ul className="mt-8 space-y-5">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
                <Icon className="size-4 text-indigo-200" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-sm text-white/60">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div aria-hidden className="relative mt-10 grid grid-cols-3 gap-2 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
        {PREVIEW.map((col) => (
          <div key={col.label} className="rounded-xl bg-white/[0.04] p-2">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-white/70">
              <span className={`size-1.5 rounded-full bg-current ${col.tone}`} />
              {col.label}
            </p>
            {col.cards.map((c) => (
              <div key={c} className="mb-1.5 rounded-lg bg-white/[0.07] px-2 py-1.5 text-[11px] text-white/80">
                {c}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />
      <div className="flex flex-col px-4 py-10 sm:px-8">
        <Logo className="lg:hidden" />
        <div className="m-auto w-full max-w-sm py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 mb-8 text-sm text-ink-muted">{subtitle}</p>
          {children}
          <p className="mt-8 text-center text-sm text-ink-muted">{footer}</p>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? "/";
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const { errors, isSubmitting } = form.formState;

  if (user) return <Navigate to={from} replace />;

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Login failed"));
    }
  });

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Sign in to your workspace."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-medium text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email?.message}>
          {(id, describedBy) => (
            <Input id={id} type="email" autoComplete="email" aria-describedby={describedBy} {...form.register("email")} />
          )}
        </Field>
        <Field label="Password" error={errors.password?.message}>
          {(id, describedBy) => (
            <Input id={id} type="password" autoComplete="current-password" aria-describedby={describedBy} {...form.register("password")} />
          )}
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
        <div className="flex items-center gap-3 text-xs text-ink-faint" aria-hidden>
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          icon={<Sparkles className="size-4" />}
          onClick={() => {
            form.setValue("email", DEMO.email);
            form.setValue("password", DEMO.password);
            void onSubmit();
          }}
        >
          Try the demo account
        </Button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });
  const { errors, isSubmitting } = form.formState;

  if (user) return <Navigate to="/" replace />;

  const onSubmit = form.handleSubmit(async ({ full_name, email, password }) => {
    try {
      await api.register({ full_name, email, password });
      await login(email, password);
      toast.success("Welcome to DevTrack!");
      navigate("/projects", { replace: true });
    } catch (err) {
      form.setError("root", { message: errorMessage(err, "Registration failed") });
    }
  });

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start tracking issues with your team in a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" error={errors.full_name?.message}>
          {(id, d) => <Input id={id} autoComplete="name" aria-describedby={d} {...form.register("full_name")} />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {(id, d) => <Input id={id} type="email" autoComplete="email" aria-describedby={d} {...form.register("email")} />}
        </Field>
        <Field label="Password" error={errors.password?.message}>
          {(id, d) => <Input id={id} type="password" autoComplete="new-password" aria-describedby={d} {...form.register("password")} />}
        </Field>
        <Field label="Confirm password" error={errors.confirm?.message}>
          {(id, d) => <Input id={id} type="password" autoComplete="new-password" aria-describedby={d} {...form.register("confirm")} />}
        </Field>
        {errors.root && (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
