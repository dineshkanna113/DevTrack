import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/auth/AuthContext";
import { Logo } from "@/components/Layout";
import { Button, Card, Field, Input } from "@/components/ui";
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

function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Logo />
      <Card className="mt-6 w-full max-w-sm p-6">
        <h1 className="mb-5 text-xl font-semibold">{title}</h1>
        {children}
      </Card>
      <p className="mt-4 text-sm text-slate-500">{footer}</p>
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
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-medium text-indigo-600 hover:underline">
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
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
        <Button
          variant="secondary"
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
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
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
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
