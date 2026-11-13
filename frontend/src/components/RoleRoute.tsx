import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../lib/types";
import NoAccess from "../pages/NoAccess";

// Cosmetic guard: the API still answers 403 if a role calls an endpoint it may not use
export default function RoleRoute({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <NoAccess />;
  return <Outlet />;
}
