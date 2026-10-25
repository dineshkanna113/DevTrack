import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { useAuth } from "./AuthContext";

export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Spinner label="Loading your workspace" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
