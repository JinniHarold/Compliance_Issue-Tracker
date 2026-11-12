import { db } from "../db/connection";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

export function getDashboard() {
  const t = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(status = 'open'), 0) AS open,
         COALESCE(SUM(status = 'in_progress'), 0) AS in_progress,
         COALESCE(SUM(status = 'in_review'), 0) AS in_review,
         COALESCE(SUM(status = 'completed'), 0) AS completed,
         COALESCE(SUM(status != 'completed' AND due_date < date('now')), 0) AS overdue,
         COALESCE(SUM(status != 'completed' AND due_date >= date('now')
                      AND due_date <= date('now', '+7 days')), 0) AS due_soon
       FROM issues`
    )
    .get() as Record<"total" | "open" | "in_progress" | "in_review" | "completed" | "overdue" | "due_soon", number>;

  const bySeverityRows = db
    .prepare("SELECT severity, COUNT(*) AS n FROM issues WHERE status != 'completed' GROUP BY severity")
    .all() as { severity: (typeof SEVERITIES)[number]; n: number }[];
  const active_by_severity = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<
    (typeof SEVERITIES)[number],
    number
  >;
  for (const r of bySeverityRows) active_by_severity[r.severity] = r.n;

  const overdue_issues = db
    .prepare(
      `SELECT i.id, i.title, i.severity, i.status, i.due_date, u.name AS owner_name,
              CAST(julianday(date('now')) - julianday(i.due_date) AS INTEGER) AS days_overdue
       FROM issues i JOIN users u ON u.id = i.owner_id
       WHERE i.status != 'completed' AND i.due_date < date('now')
       ORDER BY CASE i.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
                i.due_date
       LIMIT 5`
    )
    .all();

  const { n: pending_approvals } = db
    .prepare("SELECT COUNT(*) AS n FROM pending_actions WHERE status = 'pending'")
    .get() as { n: number };

  return {
    generated_at: new Date().toISOString(),
    totals: {
      all: t.total,
      active: t.open + t.in_progress + t.in_review, // the "Open" card: everything not completed
      open: t.open,
      in_progress: t.in_progress,
      in_review: t.in_review,
      completed: t.completed,
      overdue: t.overdue,
      due_soon: t.due_soon,
    },
    active_by_severity,
    overdue_issues,
    pending_approvals,
  };
}