import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { DashboardData, Severity } from "../lib/types";
import { SeverityBadge, StatusBadge } from "../components/Badges";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const BAR: Record<Severity, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-slate-400",
};

// Each card opens the matching filtered view
function Stat({ label, value, tone, hint, to }: { label: string; value: number; tone: string; hint?: string; to: string }) {
  return (
    <Link to={to} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-400">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${tone}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Link>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<DashboardData>("/dashboard")
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load"); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading dashboard…</p>;

  const { totals, active_by_severity, overdue_issues, pending_approvals } = data;
  const maxSeverity = Math.max(1, ...SEVERITIES.map((s) => active_by_severity[s]));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open" value={totals.active} tone="text-blue-700" hint="Not yet completed" to="/issues" />
        <Stat label="Overdue" value={totals.overdue} tone="text-red-700" hint="Past due, not completed" to="/issues?overdue=true" />
        <Stat label="Completed" value={totals.completed} tone="text-green-700" to="/issues?status=completed" />
        <Stat label="Awaiting approval" value={pending_approvals} tone="text-purple-700" hint="Agent proposals" to="/approvals" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Open issues by status</h2>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div><dt className="text-xs text-slate-500">Not started</dt><dd className="text-xl font-semibold">{totals.open}</dd></div>
            <div><dt className="text-xs text-slate-500">In progress</dt><dd className="text-xl font-semibold">{totals.in_progress}</dd></div>
            <div><dt className="text-xs text-slate-500">In review</dt><dd className="text-xl font-semibold">{totals.in_review}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">{totals.due_soon} due in the next 7 days</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Open issues by severity</h2>
          <ul className="mt-3 space-y-2">
            {SEVERITIES.map((s) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className="w-16 capitalize text-slate-600">{s}</span>
                <div className="h-3 flex-1 rounded bg-slate-100">
                  <div className={`h-3 rounded ${BAR[s]}`} style={{ width: `${(active_by_severity[s] / maxSeverity) * 100}%` }} />
                </div>
                <span className="w-6 text-right tabular-nums">{active_by_severity[s]}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Needs attention: most urgent overdue issues</h2>
        {overdue_issues.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Nothing is overdue.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2">Issue</th>
                  <th className="px-4 py-2">Severity</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Owner</th>
                  <th className="px-4 py-2">Days overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overdue_issues.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-2 font-medium">
                      <Link to={`/issues/${i.id}`} className="text-blue-700 hover:underline">{i.title}</Link>
                    </td>
                    <td className="px-4 py-2"><SeverityBadge severity={i.severity} /></td>
                    <td className="px-4 py-2"><StatusBadge status={i.status} /></td>
                    <td className="px-4 py-2">{i.owner_name}</td>
                    <td className="px-4 py-2 tabular-nums">{i.days_overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
