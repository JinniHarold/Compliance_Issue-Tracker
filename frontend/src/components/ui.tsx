import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type MouseEventHandler,
  type RefObject,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { navigateWithReveal } from "../lib/transition";
import type { Severity } from "../lib/types";
import { ConfirmContext, type ConfirmOptions } from "../lib/useConfirm";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost-danger";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", ...props },
  ref
) {
  const styles = {
    primary: "ui-button-primary",
    secondary: "ui-button-secondary",
    danger: "ui-button-danger",
    "ghost-danger": "ui-button-ghost-danger",
  }[variant];
  return (
    <button
      className={`ui-button inline-flex items-center justify-center rounded-md text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      ref={ref}
      {...props}
    />
  );
});

export function FilterToggle({
  pressed,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      aria-pressed={pressed}
      className={`filter-toggle ${pressed ? "filter-toggle-pressed" : ""} ${className}`}
    >
      {pressed && <Icon name="check" />}
      {children}
    </button>
  );
}

export function ThemeSwitch({
  dark,
  onChange,
  className = "",
}: {
  dark: boolean;
  onChange: (dark: boolean, origin: { x: number; y: number }) => void;
  className?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={buttonRef}
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      className={`theme-switch ${className}`}
      onClick={() => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) return;
        onChange(!dark, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }}
    >
      <span className="theme-switch-knob" aria-hidden="true">
        <Icon name="dark_mode" className="theme-switch-icon theme-switch-moon" />
        <Icon name="light_mode" className="theme-switch-icon theme-switch-sun" />
      </span>
    </button>
  );
}

export function MobileDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const openFrame = useRef<number | undefined>(undefined);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    window.clearTimeout(closeTimer.current);
    window.cancelAnimationFrame(openFrame.current ?? 0);

    if (open && window.matchMedia("(max-width: 767px)").matches) {
      if (!dialog.open) {
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      }
      document.body.classList.add("drawer-open");
      openFrame.current = window.requestAnimationFrame(() => {
        dialog.classList.add("mobile-drawer-visible");
        dialog.querySelector<HTMLButtonElement>("[data-drawer-close]")?.focus();
      });
    } else if (dialog.open) {
      dialog.classList.remove("mobile-drawer-visible");
      closeTimer.current = window.setTimeout(() => {
        if (dialog.open) dialog.close();
        document.body.classList.remove("drawer-open");
        if (returnFocus.current?.isConnected) returnFocus.current.focus();
        returnFocus.current = null;
      }, 250);
    }

    const onResize = () => {
      if (window.matchMedia("(min-width: 768px)").matches && dialog.open) onClose();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(closeTimer.current);
      window.cancelAnimationFrame(openFrame.current ?? 0);
    };
  }, [onClose, open]);

  useEffect(() => () => {
    document.body.classList.remove("drawer-open");
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="mobile-drawer"
      aria-label="Mobile navigation"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mobile-drawer-panel">{children}</div>
    </dialog>
  );
}

export function AuroraBackground() {
  return (
    <div className="login-scene" aria-hidden="true">
      <div className="login-blob login-blob-one" />
      <div className="login-blob login-blob-two" />
      <div className="login-blob login-blob-three" />
      <div className="login-overlay" />
    </div>
  );
}

export function AccessPage({ children }: { children: ReactNode }) {
  return <main className="access-main">{children}</main>;
}

export function AccessIconBadge() {
  return (
    <div className="access-icon-badge">
      <Icon name="lock" />
    </div>
  );
}

export function AccessLabel({ children }: { children: ReactNode }) {
  return <p className="access-label">{children}</p>;
}

export function AccessDescription({ children }: { children: ReactNode }) {
  return <p className="access-description">{children}</p>;
}

export function BackToDashboardLink() {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    linkRef.current?.focus();
  }, []);

  return (
    <RevealLink ref={linkRef} to="/" className="access-dashboard-link">
      <Icon name="arrow_back" />
      Back to dashboard
    </RevealLink>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 ${props.className ?? ""}`}
    />
  );
}

export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="checkbox"
      className={`h-4 w-4 accent-primary focus-visible:ring-2 focus-visible:ring-primary/40 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 ${props.className ?? ""}`}
    />
  );
}

export function Select({
  id,
  value,
  onChange,
  children,
  disabled,
  className = "",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...nativeProps
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const listboxId = `${controlId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const nativeRef = useRef<HTMLSelectElement>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const openFrame = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [popupParent, setPopupParent] = useState<HTMLElement | null>(null);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({});
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string; disabled?: boolean; children?: ReactNode }>(child)) return [];
    return [{
      value: String(child.props.value ?? ""),
      label: child.props.children,
      disabled: child.props.disabled ?? false,
    }];
  });
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

  function closeMenu() {
    window.cancelAnimationFrame(openFrame.current ?? 0);
    setOpen(false);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMounted(false), 150);
  }

  function openMenu() {
    if (disabled) return;
    window.clearTimeout(closeTimer.current);
    window.cancelAnimationFrame(openFrame.current ?? 0);
    setPopupParent(triggerRef.current?.closest("dialog") ?? document.body);
    setActiveIndex(Math.max(0, selectedIndex));
    setMounted(true);
    setOpen(false);
    openFrame.current = window.requestAnimationFrame(() => setOpen(true));
  }

  function commit(valueToCommit: string) {
    if (nativeRef.current) {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      valueSetter?.call(nativeRef.current, valueToCommit);
      nativeRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
    closeMenu();
    triggerRef.current?.focus();
  }

  function moveActive(direction: number) {
    if (!options.length) return;
    let next = activeIndex;
    for (let count = 0; count < options.length; count += 1) {
      next = (next + direction + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActiveIndex(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openMenu();
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) {
        const option = options[activeIndex];
        if (option && !option.disabled) commit(option.value);
      } else {
        openMenu();
      }
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) openMenu();
      let next = -1;
      if (event.key === "Home") next = options.findIndex((option) => !option.disabled);
      else {
        for (let index = options.length - 1; index >= 0; index -= 1) {
          if (!options[index].disabled) {
            next = index;
            break;
          }
        }
      }
      if (next >= 0) setActiveIndex(next);
      return;
    }
    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      typeaheadRef.current += event.key.toLocaleLowerCase();
      window.clearTimeout(typeaheadTimer.current);
      typeaheadTimer.current = window.setTimeout(() => { typeaheadRef.current = ""; }, 500);
      const start = open ? activeIndex + 1 : Math.max(0, selectedIndex + 1);
      const searchOrder = [...options.slice(start), ...options.slice(0, start)];
      const match = searchOrder.find((option) => !option.disabled && String(option.label).toLocaleLowerCase().startsWith(typeaheadRef.current));
      if (match) {
        const next = options.indexOf(match);
        setActiveIndex(next);
        if (!open) commit(match.value);
      }
    }
  }

  useLayoutEffect(() => {
    if (!mounted || !triggerRef.current) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const desiredHeight = Math.min(260, options.length * 40 + 12);
      const placeBelow = below >= desiredHeight || below >= above;
      const maxHeight = Math.max(0, Math.min(260, (placeBelow ? below : above) - 12));
      setPopupStyle({
        position: "fixed",
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        maxHeight: `${maxHeight}px`,
        ...(placeBelow ? { top: `${rect.bottom + 6}px` } : { bottom: `${window.innerHeight - rect.top + 6}px` }),
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [mounted, options.length]);

  useEffect(() => {
    if (!open) return;
    const onOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) closeMenu();
    };
    document.addEventListener("pointerdown", onOutsidePointer);
    return () => document.removeEventListener("pointerdown", onOutsidePointer);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId, open]);

  const popup = mounted && popupParent ? createPortal(
    <ul
      ref={panelRef}
      id={listboxId}
      role="listbox"
      aria-labelledby={`${controlId}-label`}
      aria-hidden={!open}
      className={`select-popover ${open ? "select-popover-open" : ""}`}
      style={popupStyle}
    >
      {options.map((option, index) => (
        <li
          key={`${option.value}-${index}`}
          id={`${listboxId}-option-${index}`}
          role="option"
          aria-selected={value === option.value}
          aria-disabled={option.disabled || undefined}
          className={`select-option ${activeIndex === index ? "select-option-active" : ""} ${value === option.value ? "select-option-selected" : ""}`}
          onPointerMove={() => !option.disabled && setActiveIndex(index)}
          onClick={() => !option.disabled && commit(option.value)}
        >
          <span>{option.label}</span>
          {value === option.value && <Icon name="check" className="text-primary" />}
        </li>
      ))}
    </ul>,
    popupParent
  ) : null;

  const { name, form, required, multiple } = nativeProps;
  return (
    <div className="select-control">
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        className={`select-trigger ${className}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : ariaLabelledBy ?? `${controlId}-label`}
        aria-controls={mounted ? listboxId : undefined}
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        onClick={() => open ? closeMenu() : openMenu()}
        onKeyDown={handleKeyDown}
      >
        <span className="truncate">{selected?.label ?? "Select an option"}</span>
        <span className="select-chevron-position" aria-hidden="true">
          <svg
            className={`select-chevron-icon ${open ? "select-chevron-icon-open" : ""}`}
            viewBox="0 0 20 20"
            focusable="false"
          >
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </span>
      </button>
      <span className="select-native-input" aria-hidden="true">
        <select
          ref={nativeRef}
          id={`${controlId}-native`}
          hidden
          value={value}
          onChange={onChange}
          onInvalid={(event) => {
            event.preventDefault();
            window.setTimeout(() => {
              triggerRef.current?.focus();
              openMenu();
            }, 0);
          }}
          disabled={disabled}
          name={name}
          form={form}
          required={required}
          multiple={multiple}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          tabIndex={-1}
        >
          {children}
        </select>
      </span>
      {popup}
    </div>
  );
}

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label id={`${id}-label`} htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-sm">{error}</p>}
    </div>
  );
}

export function Card({
  children,
  className = "",
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "dashboard" | "login" | "article" | "restricted";
}) {
  const variantClass =
    variant === "dashboard"
      ? "dashboard-card"
      : variant === "login"
        ? "login-card"
        : variant === "article"
          ? "article-card"
          : variant === "restricted"
            ? "access-card"
            : "rounded-xl border border-border bg-surface p-4 text-text";
  return <section className={`${variantClass} ${className}`}>{children}</section>;
}

export function ArticleMeta({ children }: { children: ReactNode }) {
  return <p className="article-meta">{children}</p>;
}

export function Article({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return enabled
    ? <article className="issue-article">{children}</article>
    : <div className="space-y-5">{children}</div>;
}

export function ArticleHeader({ children }: { children: ReactNode }) {
  return <header className="article-header">{children}</header>;
}

export function ArticleList({
  children,
  ordered = false,
  thread = false,
  iconSlots = false,
  variant = "article",
}: {
  children: ReactNode;
  ordered?: boolean;
  thread?: boolean;
  iconSlots?: boolean;
  variant?: "default" | "article";
}) {
  const className = variant === "default"
    ? thread ? "space-y-4" : "space-y-2"
    : thread ? "article-thread" : `article-list ${iconSlots ? "article-list-with-icons" : ""}`;
  return ordered || thread
    ? <ol className={className}>{children}</ol>
    : <ul className={className}>{children}</ul>;
}

export function ArticleListItem({
  children,
  variant = "article",
}: {
  children: ReactNode;
  variant?: "default" | "article";
}) {
  return <li className={variant === "article" ? "article-list-item" : undefined}>{children}</li>;
}

export function ArticleIconSlot({ children = "↗" }: { children?: ReactNode }) {
  return <span className="article-icon-slot" aria-hidden="true">{children}</span>;
}

export function ArticleBody({ children }: { children: ReactNode }) {
  return <div className="article-body">{children}</div>;
}

export function FilterCard({ children }: { children: ReactNode }) {
  return <section className="dashboard-card p-4">{children}</section>;
}

export function CardLink({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick: MouseEventHandler<HTMLAnchorElement>;
  children: ReactNode;
}) {
  return <Link to={to} onClick={onClick} className="block h-full p-4 text-inherit no-underline transition-colors hover:bg-primary/10">{children}</Link>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold">{children}</h2>;
}

export function CardLabel({ children }: { children: ReactNode }) {
  return <div className="text-sm text-muted">{children}</div>;
}

export function CardValue({ children }: { children: ReactNode }) {
  return <div className="mt-1 text-3xl font-semibold">{children}</div>;
}

export function CardHint({ children }: { children: ReactNode }) {
  return <div className="mt-1 text-xs text-muted">{children}</div>;
}

export function CardMetric({ children }: { children: ReactNode }) {
  return <dd className="text-xl font-semibold">{children}</dd>;
}

const dashboardSeverityClasses: Record<Severity, { bar: string; text: string }> = {
  critical: {
    bar: "bg-[var(--sev-critical)]",
    text: "text-[color:color-mix(in_srgb,var(--sev-critical)_55%,var(--text))]",
  },
  high: {
    bar: "bg-[var(--sev-high)]",
    text: "text-[color:color-mix(in_srgb,var(--sev-high)_55%,var(--text))]",
  },
  medium: {
    bar: "bg-[var(--sev-medium)]",
    text: "text-[color:color-mix(in_srgb,var(--sev-medium)_55%,var(--text))]",
  },
  low: {
    bar: "bg-[var(--sev-low)]",
    text: "text-[color:color-mix(in_srgb,var(--sev-low)_55%,var(--text))]",
  },
};

export function DashboardSeverityStat({
  severity,
  value,
  percentage,
}: {
  severity: Severity;
  value: number;
  percentage: number;
}) {
  const classes = dashboardSeverityClasses[severity];

  return (
    <li className="flex items-center gap-3 text-sm">
      <span className={`w-16 capitalize ${classes.text}`}>{severity}</span>
      <div className="h-3 flex-1 rounded bg-bg">
        <div className={`h-3 rounded ${classes.bar}`} style={{ width: `${percentage}%` }} />
      </div>
      <span className={`w-6 text-right tabular-nums ${classes.text}`}>{value}</span>
    </li>
  );
}

export const RevealLink = forwardRef<HTMLAnchorElement, {
  to: string;
  children: ReactNode;
  className?: string;
  keyboardOrigin?: "row" | "link";
}>(function RevealLink({
  to,
  children,
  className = "text-primary hover:underline",
  keyboardOrigin = "link",
}, ref) {
  const navigate = useNavigate();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.currentTarget.target === "_blank"
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const linkRect = event.currentTarget.getBoundingClientRect();
    const rowRect = keyboardOrigin === "row" ? event.currentTarget.closest("tr")?.getBoundingClientRect() : undefined;
    const rect = event.detail === 0 && rowRect ? rowRect : linkRect;
    navigateWithReveal(
      navigate,
      to,
      event.detail === 0
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: event.clientX, y: event.clientY }
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key === "Enter" || event.key === " ") event.stopPropagation();
  }

  return <Link ref={ref} to={to} onClick={onClick} onKeyDown={onKeyDown} className={className}>{children}</Link>;
});

export function LinkButton({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="link-button"><span aria-hidden="true">←</span>{children}</Link>;
}

export function ExpandToggle({
  expanded,
  controls,
  onClick,
  children = "Details",
}: {
  expanded: boolean;
  controls: string;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className="expand-toggle"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
    >
      <span>{children}</span>
      <span className={`expand-chevron ${expanded ? "expand-chevron-open" : ""}`} aria-hidden="true">›</span>
    </button>
  );
}

export function Collapse({
  id,
  expanded,
  children,
}: {
  id: string;
  expanded: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className={`collapse-panel ${expanded ? "collapse-panel-open" : ""}`}
      aria-hidden={!expanded}
      inert={!expanded}
    >
      <div className="collapse-content">{children}</div>
    </div>
  );
}

export function AuditDetails({ children }: { children: ReactNode }) {
  return (
    <div className="audit-details">
      <pre className="audit-details-json">{children}</pre>
    </div>
  );
}

export function Icon({
  name,
  className = "",
}: {
  name:
    | "check"
    | "person_remove"
    | "filter_alt_off"
    | "lock"
    | "arrow_back"
    | "light_mode"
    | "dark_mode"
    | "menu"
    | "close"
    | "logout";
  className?: string;
}) {
  return <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export function DeactivateButton({
  userName,
  disabled,
  success,
  onClick,
}: {
  userName: string;
  disabled: boolean;
  success: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`deactivate-button ${success ? "deactivate-button-success" : ""}`}
      aria-label={`Deactivate ${userName}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="deactivate-label">Deactivate</span>
      <span className="deactivate-icon"><Icon name={success ? "check" : "person_remove"} /></span>
    </button>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-md border px-3 py-2 text-sm">{children}</p>;
}

export function Spinner({ label = "Loading..." }: { label?: string }) {
  return <p role="status" className="text-sm">{label}</p>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm">{children}</p>;
}

export function Heading({
  level = 2,
  children,
  variant = "default",
}: {
  level?: 1 | 2;
  children: ReactNode;
  variant?: "default" | "article-title" | "article-section" | "access-title";
}) {
  const className = variant === "article-title"
    ? "article-title"
    : variant === "article-section"
      ? "article-section-title"
      : variant === "access-title"
        ? "access-title"
      : level === 1 ? "text-xl font-semibold" : "text-lg font-semibold";
  return level === 1 ? <h1 className={className}>{children}</h1> : <h2 className={className}>{children}</h2>;
}

export function TextContent({ children }: { children: ReactNode }) {
  return <div className="whitespace-pre-wrap">{children}</div>;
}

export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="detail-list">{children}</dl>;
}

export function DetailRow({
  label,
  children,
  empty = false,
}: {
  label: string;
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="detail-row">
      <dt className="detail-key">{label}</dt>
      <dd className={`detail-value ${empty ? "detail-value-empty" : ""}`}>{children}</dd>
    </div>
  );
}

export function TableContainer({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl">{children}</div>;
}

export function Table({ children }: { children: ReactNode }) {
  return <table className="block w-full text-left text-sm md:table">{children}</table>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="sr-only border-b text-xs font-semibold uppercase tracking-wider text-muted md:not-sr-only">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="block md:table-row-group">{children}</tbody>;
}

const severityAccentClasses: Record<Severity, string> = {
  critical: "data-[severity=critical]:[&>td:first-child]:border-l-red-500",
  high: "data-[severity=high]:[&>td:first-child]:border-l-orange-500",
  medium: "data-[severity=medium]:[&>td:first-child]:border-l-amber-500",
  low: "data-[severity=low]:[&>td:first-child]:border-l-slate-400",
};

export function TableRow({
  children,
  navigateTo,
  ariaLabel,
  severityAccent,
}: {
  children: ReactNode;
  navigateTo?: string;
  ariaLabel?: string;
  severityAccent?: Severity;
}) {
  const navigate = useNavigate();

  function isPlainRowClick(event: MouseEvent<HTMLTableRowElement>) {
    return (
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      !(event.target instanceof Element && event.target.closest("a, button, input, select, textarea, [role='button']"))
    );
  }

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    if (!navigateTo || !isPlainRowClick(event)) return;
    event.preventDefault();
    navigateWithReveal(navigate, navigateTo, { x: event.clientX, y: event.clientY });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (!navigateTo || event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    navigateWithReveal(navigate, navigateTo, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  return (
    <tr
      data-severity={severityAccent}
      className={`border-b border-border transition-colors hover:bg-primary/10 last:border-0 max-md:mb-3 max-md:grid max-md:rounded-lg max-md:border max-md:bg-surface max-md:px-3 ${severityAccent ? severityAccentClasses[severityAccent] : ""} ${navigateTo ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" : ""}`}
      onClick={navigateTo ? handleClick : undefined}
      onKeyDown={navigateTo ? handleKeyDown : undefined}
      tabIndex={navigateTo ? 0 : undefined}
      aria-label={navigateTo ? ariaLabel : undefined}
    >
      {children}
    </tr>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 font-semibold">{children}</th>;
}

export function TableCell({
  children,
  label,
  colSpan,
  className = "",
}: {
  children: ReactNode;
  label?: string;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      data-label={label}
      colSpan={colSpan}
      className={`first:border-l-2 first:border-l-transparent border-b border-border px-4 py-3 align-middle last:border-0 max-md:flex max-md:items-start max-md:justify-between max-md:gap-4 max-md:px-2 max-md:py-3 max-md:before:font-medium max-md:before:text-muted max-md:before:content-[attr(data-label)] ${className}`}
    >
      {children}
    </td>
  );
}

export function Dialog({
  open,
  onClose,
  onClosed,
  title,
  children,
  variant = "standard",
  role = "dialog",
  descriptionId,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  onClosed?: () => void;
  title: string;
  children: ReactNode;
  variant?: "standard" | "sheet";
  role?: "dialog" | "alertdialog";
  descriptionId?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeTimer = useRef<number | undefined>(undefined);
  const openFrame = useRef<number | undefined>(undefined);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    window.clearTimeout(closeTimer.current);
    window.cancelAnimationFrame(openFrame.current ?? 0);

    if (open) {
      if (!dialog.open) {
        previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      }
      openFrame.current = window.requestAnimationFrame(() => {
        dialog.classList.remove("app-dialog-closing");
        dialog.classList.add("app-dialog-visible");
        initialFocusRef?.current?.focus();
      });
    } else if (dialog.open) {
      dialog.classList.remove("app-dialog-visible");
      dialog.classList.add("app-dialog-closing");
      closeTimer.current = window.setTimeout(() => {
        if (dialog.open) dialog.close();
        dialog.classList.remove("app-dialog-closing");
        if (previousFocus.current?.isConnected) previousFocus.current.focus();
        previousFocus.current = null;
        onClosed?.();
      }, variant === "sheet" ? 200 : 180);
    }

    return () => {
      window.clearTimeout(closeTimer.current);
      window.cancelAnimationFrame(openFrame.current ?? 0);
    };
  }, [initialFocusRef, onClosed, open, variant]);

  return (
    <dialog
      ref={dialogRef}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={`app-dialog ${variant === "sheet" ? "confirm-dialog" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`app-dialog-content space-y-4 p-5 ${variant === "sheet" ? "confirm-dialog-content" : ""}`}>
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setRequest(options);
    setOpen(true);
  }), []);

  const finish = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setOpen(false);
  }, []);

  const clearRequest = useCallback(() => setRequest(null), []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        request={request}
        open={open}
        onClose={() => finish(false)}
        onConfirm={() => finish(true)}
        onClosed={clearRequest}
      />
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  request,
  open,
  onClose,
  onConfirm,
  onClosed,
}: {
  request: ConfirmOptions | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onClosed: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  if (!request) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onClosed={onClosed}
      title={request.title}
      variant="sheet"
      role="alertdialog"
      descriptionId="confirm-dialog-message"
      initialFocusRef={cancelRef}
    >
      <p id="confirm-dialog-message">{request.message}</p>
      <div className="flex justify-end gap-2">
        <Button ref={cancelRef} variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={request.tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
          {request.confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total?: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
      <span className="text-sm">Page {page} of {pages}{total !== undefined ? ` (${total})` : ""}</span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
    </nav>
  );
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-2">
      {items.map((item) => (
        <Button
          key={item.value}
          role="tab"
          aria-selected={value === item.value}
          variant={value === item.value ? "primary" : "secondary"}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
