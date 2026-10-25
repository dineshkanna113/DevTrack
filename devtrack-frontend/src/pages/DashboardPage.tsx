import { AlertTriangle, CheckCircle2, CircleDot, Layers } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/auth/AuthContext";
import { DueDate, PriorityBadge, StatusLabel } from "@/components/issues/IssueBadges";
import { Card, EmptyState, Select, Spinner } from "@/components/ui";
import { useMyIssues, useProjects, useStats } from "@/hooks/queries";
import { useTheme } from "@/hooks/useTheme";
import { PRIORITIES, STATUSES } from "@/lib/constants";
import { parseDate } from "@/lib/format";
import type { ProjectStats } from "@/lib/types";

// Validated categorical slots 1–2 (blue, orange), each stepped separately for light and dark surfaces.
const PALETTE = {
  light: { series1: "#2a78d6", series2: "#eb6834", grid: "#e2e8f0", text: "#64748b", surface: "#ffffff" },
  dark: { series1: "#3987e5", series2: "#d95926", grid: "#1e293b", text: "#94a3b8", surface: "#0f172a" },
};

function Kpi({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className={tone}>{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function ChartCard({ title, children, table }: { title: string; children: ReactNode; table: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button type="button" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => setShowTable((v) => !v)}>
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>
      {showTable ? <div className="h-60 overflow-auto text-sm">{table}</div> : <div className="h-60">{children}</div>}
    </Card>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="text-left text-xs text-slate-500">{head.map((h) => <th key={h} className="py-1 font-medium">{h}</th>)}</tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((r) => <tr key={String(r[0])}>{r.map((c, i) => <td key={i} className="py-0.5">{c}</td>)}</tr>)}
      </tbody>
    </table>
  );
}

function Charts({ stats }: { stats: ProjectStats }) {
  const { theme } = useTheme();
  const c = PALETTE[theme];
  const axis = { stroke: c.text, fontSize: 12, tickLine: false, axisLine: false } as const;
  const tooltipStyle = {
    contentStyle: { background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 8, fontSize: 12 },
    labelStyle: { color: c.text },
  };

  const daily = stats.daily.map((d) => ({
    ...d,
    label: parseDate(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  const byStatus = STATUSES.map((s) => ({ name: s.label, count: stats.by_status[s.value] }));
  const byPriority = PRIORITIES.map((p) => ({ name: p.label, count: stats.by_priority[p.value] }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <ChartCard
          title="Created vs resolved · last 14 days"
          table={<DataTable head={["Date", "Created", "Resolved"]} rows={daily.map((d) => [d.label, d.created, d.resolved])} />}
        >
          <ResponsiveContainer>
            <LineChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tooltipStyle} cursor={{ stroke: c.text, strokeDasharray: "3 3" }} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: c.text }} />
              <Line type="linear" dataKey="created" name="Created" stroke={c.series1} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
              <Line type="linear" dataKey="resolved" name="Resolved" stroke={c.series2} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      {[
        { title: "Issues by status", data: byStatus },
        { title: "Issues by priority", data: byPriority },
      ].map(({ title, data }) => (
        <ChartCard key={title} title={title} table={<DataTable head={["", "Issues"]} rows={data.map((d) => [d.name, d.count])} />}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 8 }} barCategoryGap={8}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={84} {...axis} />
              <Tooltip {...tooltipStyle} cursor={{ fill: c.grid, opacity: 0.5 }} />
              <Bar dataKey="count" name="Issues" fill={c.series1} radius={[0, 4, 4, 0]} maxBarSize={28}>
                <LabelList dataKey="count" position="right" fill={c.text} fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data: projects, isLoading } = useProjects();
  const [selected, setSelected] = useState<number | null>(null);
  const projectId = selected ?? projects?.[0]?.id;
  const { data: stats } = useStats(projectId);
  const { data: myIssues } = useMyIssues();

  if (isLoading) return <Spinner label="Loading dashboard" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user?.full_name.split(" ")[0]}</h1>
          <p className="text-sm text-slate-500">Here's what's happening across your projects.</p>
        </div>
        {projects && projects.length > 0 && (
          <Select aria-label="Project" className="w-auto" value={projectId} onChange={(e) => setSelected(Number(e.target.value))}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}
          </Select>
        )}
      </div>

      {!projects?.length ? (
        <EmptyState title="No projects yet" description="Create a project to see analytics here." action={<Link className="text-indigo-600" to="/projects">Go to projects</Link>} />
      ) : !stats ? (
        <Spinner label="Loading stats" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Open" value={stats.open} icon={<CircleDot className="size-4" />} tone="text-blue-600" />
            <Kpi label="Done" value={stats.done} icon={<CheckCircle2 className="size-4" />} tone="text-emerald-600" />
            <Kpi label="Overdue" value={stats.overdue} icon={<AlertTriangle className="size-4" />} tone="text-red-600" />
            <Kpi label="Total" value={stats.total} icon={<Layers className="size-4" />} tone="text-slate-500" />
          </div>
          <Charts stats={stats} />
        </>
      )}

      <Card>
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">Assigned to me</h2>
        {!myIssues ? <Spinner /> : myIssues.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Nothing assigned to you. 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {myIssues.map((issue) => (
              <li key={issue.id}>
                <Link to={`/projects/${issue.project_id}?issue=${issue.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <span className="font-mono text-xs text-slate-500">{issue.key}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{issue.title}</span>
                  <DueDate issue={issue} />
                  <PriorityBadge value={issue.priority} />
                  <StatusLabel value={issue.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
