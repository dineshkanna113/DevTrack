import clsx from "clsx";
import {
  ChevronRight,
  ChevronsUpDown,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useProjects } from "@/hooks/queries";
import { useTheme } from "@/hooks/useTheme";
import { Avatar, Button } from "./ui";

/*
 * App shell: a sidebar with navigation and the user's projects, plus a slim top bar.
 * The structure follows the Watermelon UI "Jobtracker" dashboard shell; on small
 * screens the sidebar becomes an off-canvas drawer.
 */

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban, end: false },
];

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("flex items-center gap-2 text-lg font-semibold tracking-tight", className)}>
      <img src="/favicon.svg" alt="" className="size-7" />
      <span>
        Dev<span className="text-brand">Track</span>
      </span>
    </span>
  );
}

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
    isActive
      ? "bg-surface text-brand-ink shadow-sm ring-1 ring-line dark:text-white"
      : "text-ink-muted hover:bg-surface hover:text-ink",
  );

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-9 px-0"
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function SidebarProjects() {
  const { data: projects } = useProjects();
  if (!projects?.length) return null;
  return (
    <div className="mt-8">
      <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
        Your projects
      </p>
      <ul className="space-y-0.5">
        {projects.slice(0, 8).map((p) => (
          <li key={p.id}>
            <NavLink
              to={`/projects/${p.id}`}
              className={({ isActive }) =>
                clsx(
                  "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors",
                  isActive ? "bg-surface font-medium text-ink ring-1 ring-line" : "text-ink-muted hover:bg-surface hover:text-ink",
                )
              }
            >
              <span className="grid h-5 min-w-8 place-items-center rounded-md bg-brand-soft px-1 font-mono text-[10px] font-semibold text-brand-ink">
                {p.key}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.open_issues > 0 && <span className="text-xs tabular-nums text-ink-faint">{p.open_issues}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UserCard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-surface p-2 ring-1 ring-line">
      <Avatar name={user.full_name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.full_name}</p>
        <p className="truncate text-xs text-ink-faint">{user.email}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="size-8 px-0 hover:text-red-600 dark:hover:text-red-400"
        aria-label="Log out"
        onClick={() => {
          logout();
          navigate("/login");
        }}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div
        className={clsx(
          "fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-68 flex-col border-r border-line bg-sunken px-3 py-4 transition-transform md:translate-x-0",
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
        aria-label="Sidebar"
      >
        <div className="flex items-center justify-between px-2">
          <Link to="/" aria-label="DevTrack home" className="rounded-md">
            <Logo />
          </Link>
          <Button variant="ghost" size="sm" className="size-8 px-0 md:hidden" onClick={onClose} aria-label="Close menu">
            <X className="size-4" />
          </Button>
        </div>

        <nav className="mt-7 space-y-1" aria-label="Main">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navItemClass}>
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarProjects />
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between px-3 text-xs text-ink-faint">
            <span>Appearance</span>
            <ThemeToggle />
          </div>
          <UserCard />
        </div>
      </aside>
    </>
  );
}

function useCrumbs() {
  const { pathname } = useLocation();
  const { data: projects } = useProjects();
  const match = pathname.match(/^\/projects\/(\d+)/);
  if (match) {
    const project = projects?.find((p) => p.id === Number(match[1]));
    return [{ label: "Projects", to: "/projects" }, { label: project?.name ?? "Project" }];
  }
  if (pathname.startsWith("/projects")) return [{ label: "Projects" }];
  if (pathname === "/") return [{ label: "Dashboard" }];
  return [{ label: "DevTrack" }];
}

function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open profile menu"
        className="flex items-center gap-1 rounded-full bg-sunken p-1 pr-2 ring-1 ring-line transition hover:bg-raised"
      >
        <Avatar name={user.full_name} size="md" />
        <ChevronsUpDown className="size-3.5 text-ink-faint" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-line bg-raised p-1.5 shadow-xl"
        >
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={user.full_name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.full_name}</p>
              <p className="truncate text-xs text-ink-faint">{user.email}</p>
            </div>
          </div>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const crumbs = useCrumbs();
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur sm:px-6 lg:px-10">
      <Button variant="ghost" size="sm" className="size-9 px-0 md:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="size-5" />
      </Button>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {crumbs.map((c, i) => (
            <li key={c.label} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden />}
              {"to" in c && c.to ? (
                <Link to={c.to} className="text-ink-muted hover:text-ink">{c.label}</Link>
              ) : (
                <span className="truncate font-medium" aria-current="page">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <ProfileMenu />
    </header>
  );
}

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-h-screen flex-col md:pl-68">
        <TopBar onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
