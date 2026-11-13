export type Role = "admin" | "owner" | "auditor" | "agent";
export type Severity = "low" | "medium" | "high" | "critical";
export type Status = "open" | "in_progress" | "in_review" | "completed";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface DashboardData {
  generated_at: string;
  totals: {
    all: number;
    active: number; // everything not completed: the "Open" card
    open: number;
    in_progress: number;
    in_review: number;
    completed: number;
    overdue: number;
    due_soon: number;
  };
  active_by_severity: Record<Severity, number>;
  overdue_issues: {
    id: string;
    title: string;
    severity: Severity;
    status: Status;
    due_date: string;
    owner_name: string;
    days_overdue: number;
  }[];
  pending_approvals: number;
}
