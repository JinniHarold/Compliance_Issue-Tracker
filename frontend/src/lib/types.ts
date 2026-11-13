export type Role = "admin" | "owner" | "auditor" | "agent";
export type Severity = "low" | "medium" | "high" | "critical";
export type Status = "open" | "in_progress" | "in_review" | "completed";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface UserRecord extends User {
  is_active: boolean;
  created_at: string;
}

export type UserRow = UserRecord;

export interface PendingAction {
  id: string;
  issue_id: string;
  issue_title: string;
  action_type: "start" | "request_review" | "request_revision" | "complete" | "reopen" | "update_severity";
  payload: { comment?: string; severity?: Severity };
  rationale: string;
  requested_by: string;
  requested_by_name: string;
  status: "pending" | "approved" | "rejected";
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  created_at: string;
  actor_id: string;
  actor_email: string;
  actor_name: string;
  actor_type: "human" | "agent";
  action: string;
  entity_type: "issue" | "user";
  entity_id: string;
  details: Record<string, unknown>;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: Status;
  owner_id: string;
  owner_name: string;
  due_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  is_overdue: boolean;
  evidence_count: number;
}

export type Paged<T, K extends string = "issues"> = {
  page: number;
  limit: number;
  total: number;
} & Record<K, T[]>;

export interface IssueComment {
  id: string;
  issue_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  kind: "comment" | "review_requested" | "revision_requested" | "approved" | "reopened";
  body: string;
  created_at: string;
}

export interface Evidence {
  id: string;
  issue_id: string;
  kind: "link";
  reference: string;
  note: string;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
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
