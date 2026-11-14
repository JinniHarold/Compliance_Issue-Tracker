import { useEffect, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import {
  Alert,
  Card,
  CardHint,
  CardLabel,
  CardLink,
  CardMetric,
  CardTitle,
  CardValue,
  DashboardSeverityStat,
  EmptyState,
  Heading,
  RevealLink,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui";
import { api } from "../lib/api";
import { navigateWithReveal } from "../lib/transition";
import type { DashboardData, Severity } from "../lib/types";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

function Stat({
  label,
  value,
  hint,
  to,
}: {
  label: string;
  value: number;
  hint?: string;
  to: string;
}) {
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
    const rect = event.currentTarget.getBoundingClientRect();
    const keyboardActivation = event.detail === 0;
    navigateWithReveal(navigate, to, keyboardActivation
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: event.clientX, y: event.clientY });
  }

  return (
    <Card variant="dashboard">
      <CardLink to={to} onClick={onClick}>
        <CardLabel>{label}</CardLabel>
        <CardValue>{value}</CardValue>
        {hint && <CardHint>{hint}</CardHint>}
      </CardLink>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<DashboardData>("/dashboard")
      .then((result) => { if (!cancelled) setData(result); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Failed to load"); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner label="Loading dashboard..." />;

  const { totals, active_by_severity, overdue_issues, pending_approvals } = data;
  const maxSeverity = Math.max(1, ...SEVERITIES.map((severity) => active_by_severity[severity]));

  return (
    <div className="space-y-6">
      <Heading level={1}>Dashboard</Heading>

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-4">
        <Stat label="Open" value={totals.active} hint="Not yet completed" to="/issues" />
        <Stat label="Overdue" value={totals.overdue} hint="Past due, not completed" to="/issues?overdue=true" />
        <Stat label="Completed" value={totals.completed} to="/issues?status=completed" />
        <Stat label="Awaiting approval" value={pending_approvals} hint="Agent proposals" to="/approvals" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="dashboard" className="space-y-3 p-4">
          <CardTitle>Open issues by status</CardTitle>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div><dt>Not started</dt><CardMetric>{totals.open}</CardMetric></div>
            <div><dt>In progress</dt><CardMetric>{totals.in_progress}</CardMetric></div>
            <div><dt>In review</dt><CardMetric>{totals.in_review}</CardMetric></div>
          </dl>
          <CardHint>{totals.due_soon} due in the next 7 days</CardHint>
        </Card>

        <Card variant="dashboard" className="space-y-3 p-4">
          <CardTitle>Open issues by severity</CardTitle>
          <ul className="space-y-2">
            {SEVERITIES.map((severity) => (
              <DashboardSeverityStat
                key={severity}
                severity={severity}
                value={active_by_severity[severity]}
                percentage={(active_by_severity[severity] / maxSeverity) * 100}
              />
            ))}
          </ul>
        </Card>
      </div>

      <Card variant="dashboard" className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
          <div className="space-y-1">
            <CardTitle>Needs attention: most urgent overdue issues</CardTitle>
            <CardHint>Prioritized by how long each issue is overdue.</CardHint>
          </div>
          <Link to="/issues?overdue=true" className="text-sm font-medium text-primary hover:underline">View all</Link>
        </div>
        {overdue_issues.length === 0 ? (
          <EmptyState>Nothing is overdue.</EmptyState>
        ) : (
          <TableContainer>
            <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Issue</TableHeader>
                <TableHeader>Severity</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Owner</TableHeader>
                <TableHeader>Days overdue</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {overdue_issues.map((issue) => (
                <TableRow
                  key={issue.id}
                  navigateTo={`/issues/${issue.id}`}
                  ariaLabel={`Open issue: ${issue.title}`}
                  severityAccent={issue.severity}
                >
                  <TableCell label="Issue">
                    <RevealLink to={`/issues/${issue.id}`} keyboardOrigin="row">{issue.title}</RevealLink>
                  </TableCell>
                  <TableCell label="Severity"><SeverityBadge severity={issue.severity} /></TableCell>
                  <TableCell label="Status"><StatusBadge status={issue.status} /></TableCell>
                  <TableCell label="Owner">{issue.owner_name}</TableCell>
                  <TableCell label="Days overdue">{issue.days_overdue} days overdue</TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </div>
  );
}
