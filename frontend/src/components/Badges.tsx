import type { Severity, Status } from "../lib/types";

const SEVERITY: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 ring-red-200",
  high: "bg-orange-100 text-orange-800 ring-orange-200",
  medium: "bg-amber-100 text-amber-800 ring-amber-200",
  low: "bg-slate-100 text-slate-700 ring-slate-200",
};

const STATUS: Record<Status, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-blue-100 text-blue-800 ring-blue-200" },
  in_progress: { label: "In progress", cls: "bg-indigo-100 text-indigo-800 ring-indigo-200" },
  in_review: { label: "In review", cls: "bg-purple-100 text-purple-800 ring-purple-200" },
  completed: { label: "Completed", cls: "bg-green-100 text-green-800 ring-green-200" },
};

const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`${base} ${SEVERITY[severity]} capitalize`}>{severity}</span>;
}

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`${base} ${s.cls}`}>{s.label}</span>;
}
