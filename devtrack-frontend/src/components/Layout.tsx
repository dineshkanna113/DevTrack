import clsx from "clsx";
import { FolderKanban, LayoutDashboard, LogOut, Moon, Sun } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { Avatar, Button } from "./ui";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban, end: false },
];

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <img src="/favicon.svg" alt="" className="size-7" />
      DevTrack
    </span>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-6">
          <Logo />
          <nav className="flex gap-1" aria-label="Main">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
                  )
                }
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            {user && (
              <span className="hidden items-center gap-2 text-sm md:flex">
                <Avatar name={user.full_name} />
                {user.full_name}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              icon={<LogOut className="size-4" />}
            >
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
