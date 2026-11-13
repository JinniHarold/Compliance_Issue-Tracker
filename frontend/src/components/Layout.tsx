import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { Role } from "../lib/types";

interface NavItem {
  to: string;
  label: string;
  roles?: Role[]; // omitted = everyone. This only hides links; the API enforces permissions.
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/issues", label: "Issues" },
  { to: "/approvals", label: "Approvals" },
  { to: "/users", label: "Users", roles: ["admin"] },
  { to: "/audit", label: "Audit Logs", roles: ["admin", "auditor"] },
];

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
  }`;

function NavLinks({ items, pending, onNavigate }: { items: NavItem[]; pending: number; onNavigate?: () => void }) {
  return (
    <>
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.to === "/"} className={linkCls} onClick={onNavigate}>
          {i.label}
          {i.to === "/approvals" && pending > 0 && (
            <span
              aria-label={`${pending} waiting for a decision`}
              className="rounded-full bg-purple-600 px-1.5 text-xs font-semibold leading-5 text-white"
            >
              {pending}
            </span>
          )}
        </NavLink>
      ))}
    </>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [pendingRevision, setPendingRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setPendingRevision((revision) => revision + 1);
    window.addEventListener("pending-actions-updated", refresh);
    return () => window.removeEventListener("pending-actions-updated", refresh);
  }, []);

  // Count of proposals waiting for a decision; refreshed when the user changes page
  useEffect(() => {
    let cancelled = false;
    api<{ total: number }>("/pending-actions?status=pending&limit=1")
      .then((r) => { if (!cancelled) setPending(r.total); })
      .catch(() => { /* the badge is optional */ });
    return () => { cancelled = true; };
  }, [location.pathname, pendingRevision]);

  if (!user) return null;
  const items = NAV.filter((i) => !i.roles || i.roles.includes(user.role));

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <span className="text-base font-semibold">Compliance Tracker</span>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            <NavLinks items={items} pending={pending} />
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <div className="font-medium leading-tight">{user.name}</div>
              <div className="text-xs capitalize text-slate-500">{user.role}</div>
            </div>
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              Log out
            </button>
            <button
              aria-label="Toggle menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm md:hidden"
            >
              Menu
            </button>
          </div>
        </div>

        {open && (
          <nav aria-label="Mobile" className="flex flex-col gap-1 border-t border-slate-200 px-4 py-2 md:hidden">
            <NavLinks items={items} pending={pending} onNavigate={() => setOpen(false)} />
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
