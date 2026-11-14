import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { Role } from "../lib/types";
import { Button, Icon, MobileDrawer, ThemeSwitch } from "./ui";
import { revealTransition } from "../lib/transition";

interface NavItem {
  to: string;
  label: string;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/issues", label: "Issues" },
  { to: "/approvals", label: "Approvals" },
  { to: "/users", label: "Users", roles: ["admin"] },
  { to: "/audit", label: "Audit Logs", roles: ["admin", "auditor"] },
];

function isActivePath(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
}

function NavLinks({
  items,
  pending,
  onNavigate,
}: {
  items: NavItem[];
  pending: number;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const [hoveredTo, setHoveredTo] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const activeTo = items.find((item) => isActivePath(pathname, item.to))?.to ?? null;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const indicator = indicatorRef.current;
    const targetLink = linkRefs.current.get(hoveredTo ?? activeTo ?? "");
    if (!root || !indicator || !targetLink) {
      if (indicator) indicator.style.opacity = "0";
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const linkRect = targetLink.getBoundingClientRect();
    indicator.style.opacity = "1";
    indicator.style.width = `${linkRect.width}px`;
    indicator.style.height = `${linkRect.height}px`;
    indicator.style.transform = `translate3d(${linkRect.left - rootRect.left}px, ${linkRect.top - rootRect.top}px, 0)`;

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      pillRef.current?.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.08, 1.12)" }, { transform: "scale(1)" }],
        { duration: 230, easing: "ease-out" }
      );
    }

    const reposition = () => {
      const currentTarget = linkRefs.current.get(hoveredTo ?? activeTo ?? "");
      const currentIndicator = indicatorRef.current;
      const currentRoot = rootRef.current;
      if (!currentTarget || !currentIndicator || !currentRoot) return;
      const currentRootRect = currentRoot.getBoundingClientRect();
      const currentLinkRect = currentTarget.getBoundingClientRect();
      currentIndicator.style.width = `${currentLinkRect.width}px`;
      currentIndicator.style.height = `${currentLinkRect.height}px`;
      currentIndicator.style.transform = `translate3d(${currentLinkRect.left - currentRootRect.left}px, ${currentLinkRect.top - currentRootRect.top}px, 0)`;
    };
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [activeTo, hoveredTo, items.length, pending]);

  return (
    <nav
      ref={rootRef}
      aria-label={onNavigate ? "Mobile" : "Main"}
      className={`nav-links relative flex items-center gap-1 ${onNavigate ? "mobile-nav flex-col items-stretch" : "hidden md:flex"}`}
      onPointerLeave={() => setHoveredTo(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHoveredTo(null);
      }}
    >
      <span ref={indicatorRef} className="nav-indicator" aria-hidden="true">
        <span ref={pillRef} className="nav-indicator-pill" />
      </span>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          ref={(element) => {
            if (element) linkRefs.current.set(item.to, element);
            else linkRefs.current.delete(item.to);
          }}
          className={onNavigate ? "nav-link mobile-nav-link" : "nav-link"}
          onPointerEnter={() => setHoveredTo(item.to)}
          onFocus={() => setHoveredTo(item.to)}
          onClick={onNavigate}
        >
          {item.label}
          {item.to === "/approvals" && pending > 0 && (
            <span className="nav-count" aria-label={`${pending} waiting for a decision`}>
              {pending}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [pendingRevision, setPendingRevision] = useState(0);
  const [lightTheme, setLightTheme] = useState(() => document.documentElement.dataset.theme === "light");
  const closeDrawer = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const refresh = () => setPendingRevision((revision) => revision + 1);
    window.addEventListener("pending-actions-updated", refresh);
    return () => window.removeEventListener("pending-actions-updated", refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<{ total: number }>("/pending-actions?status=pending&limit=1")
      .then((response) => { if (!cancelled) setPending(response.total); })
      .catch(() => { /* The badge is optional. */ });
    return () => { cancelled = true; };
  }, [location.pathname, pendingRevision]);

  const changeTheme = useCallback((dark: boolean, origin: { x: number; y: number }) => {
    revealTransition(() => {
      const nextTheme = dark ? "dark" : "light";
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem("theme", nextTheme);
      setLightTheme(nextTheme === "light");
    }, origin);
  }, []);

  if (!user) return null;
  const items = NAV.filter((item) => !item.roles || item.roles.includes(user.role));

  function signOut() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="app-header border-b">
        <div className="app-header-inner mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <span className="text-base font-semibold">Compliance Tracker</span>

          <NavLinks items={items} pending={pending} />

          <div className="desktop-header-actions flex items-center gap-3">
            <div className="hidden text-right text-sm md:block">
              <div className="font-medium leading-tight">{user.name}</div>
              <div className="text-xs capitalize text-muted">{user.role}</div>
            </div>
            <ThemeSwitch dark={!lightTheme} onChange={changeTheme} />
            <button
              type="button"
              onClick={signOut}
              className="layout-action"
            >
              Log out
            </button>
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-navigation"
              onClick={() => setOpen((isOpen) => !isOpen)}
              className="mobile-menu-button md:hidden"
            >
              <Icon name={open ? "close" : "menu"} className={open ? "menu-icon-open" : "menu-icon"} />
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer open={open} onClose={closeDrawer}>
        <div id="mobile-navigation" className="mobile-drawer-content">
          <div className="mobile-drawer-header">
            <span className="text-base font-semibold">Compliance Tracker</span>
            <button
              type="button"
              aria-label="Close menu"
              data-drawer-close
              className="mobile-menu-button"
              onClick={closeDrawer}
            >
              <Icon name="close" />
            </button>
          </div>
          <NavLinks items={items} pending={pending} onNavigate={closeDrawer} />
          <div className="mobile-drawer-footer">
            <div className="mobile-drawer-theme">
              <span>Dark mode</span>
              <ThemeSwitch dark={!lightTheme} onChange={changeTheme} />
            </div>
            <Button variant="ghost-danger" className="mobile-drawer-logout" onClick={signOut}>
              <Icon name="logout" />
              Log out
            </Button>
          </div>
        </div>
      </MobileDrawer>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
