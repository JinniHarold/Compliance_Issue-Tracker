export type Severity = "low" | "medium" | "high" | "critical";
export type Status = "open" | "in_progress" | "in_review" | "completed";
export type ProposalType =
  | "start" | "request_review" | "request_revision" | "complete" | "reopen" | "update_severity";

// Only structured fields are used for decisions. Free text (titles, comments) is never interpreted.
export interface Issue {
  id: string;
  title: string;
  severity: Severity;
  status: Status;
  owner_name: string;
  due_date: string; // YYYY-MM-DD
  updated_at: string; // UTC "YYYY-MM-DD HH:MM:SS"
  evidence_count: number;
}

export type FindingCode =
  | "OVERDUE" | "DUE_SOON" | "NOT_STARTED" | "STALLED" | "NO_EVIDENCE"
  | "IN_REVIEW_NO_EVIDENCE" | "IN_REVIEW_READY" | "SEVERITY_LOW_FOR_AGE";

export interface Finding {
  code: FindingCode;
  detail: string;
}

export interface Proposal {
  action_type: ProposalType;
  rationale: string;
  comment?: string;
  severity?: Severity;
}

export interface Analysis {
  findings: Finding[];
  steps: string[];
  proposals: Proposal[];
  fingerprint: string; // changes only when the SET of findings changes, not when day counts change
}
