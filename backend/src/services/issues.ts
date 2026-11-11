import crypto from "node:crypto";
import { db } from "../db/connection";
import type { AuthUser } from "../middleware/auth";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors";
import { recordAudit } from "./audit";
import { insertComment, type CommentKind } from "./comments";

export type Severity = "low" | "medium" | "high" | "critical";
export type Status = "open" | "in_progress" | "in_review" | "completed";

interface IssueRow {
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
  is_overdue: number;
  evidence_count: number;
}

export interface Issue extends Omit<IssueRow, "is_overdue"> {
  is_overdue: boolean;
}

const toIssue = (r: IssueRow): Issue => ({ ...r, is_overdue: r.is_overdue === 1 });

// "Overdue" is computed here, never stored, so it can't go stale
const OVERDUE_SQL = "(i.status != 'completed' AND i.due_date < date('now'))";

const SELECT = `
  SELECT i.id, i.title, i.description, i.severity, i.status, i.owner_id,
         u.name AS owner_name, i.due_date, i.created_by, i.created_at,
         i.updated_at, i.completed_at,
         CASE WHEN ${OVERDUE_SQL} THEN 1 ELSE 0 END AS is_overdue,
         (SELECT COUNT(*) FROM evidence e WHERE e.issue_id = i.id) AS evidence_count
  FROM issues i
  JOIN users u ON u.id = i.owner_id`;

// Sort options are an allowlist: user input only picks a key, never becomes SQL
const SORTS = {
  due_date: "i.due_date",
  created_at: "i.created_at",
  updated_at: "i.updated_at",
  severity: "CASE i.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END",
} as const;

export type SortKey = keyof typeof SORTS;

export interface ListFilters {
  status?: Status;
  severity?: Severity;
  owner_id?: string;
  overdue?: boolean;
  search?: string;
  sort: SortKey;
  order: "asc" | "desc";
  page: number;
  limit: number;
}

export function listIssues(f: ListFilters) {
  const where: string[] = [];
  const params: unknown[] = [];

  if (f.status) { where.push("i.status = ?"); params.push(f.status); }
  if (f.severity) { where.push("i.severity = ?"); params.push(f.severity); }
  if (f.owner_id) { where.push("i.owner_id = ?"); params.push(f.owner_id); }
  if (f.overdue !== undefined) {
    where.push(f.overdue ? OVERDUE_SQL : `NOT ${OVERDUE_SQL}`);
  }
  if (f.search) {
    where.push("(i.title LIKE ? ESCAPE '\\' OR i.description LIKE ? ESCAPE '\\')");
    const like = `%${f.search.replace(/[\\%_]/g, "\\$&")}%`; // treat % and _ as plain text
    params.push(like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM issues i ${whereSql}`).get(...params) as { n: number };

  const rows = db
    .prepare(
      `${SELECT} ${whereSql}
       ORDER BY ${SORTS[f.sort]} ${f.order === "desc" ? "DESC" : "ASC"}, i.id
       LIMIT ? OFFSET ?`
    )
    .all(...params, f.limit, (f.page - 1) * f.limit) as IssueRow[];

  return { issues: rows.map(toIssue), page: f.page, limit: f.limit, total: n };
}

export function getIssue(id: string): Issue {
  const row = db.prepare(`${SELECT} WHERE i.id = ?`).get(id) as IssueRow | undefined;
  if (!row) throw notFound("Issue not found");
  return toIssue(row);
}

function assertAssignableOwner(ownerId: string) {
  const u = db.prepare("SELECT role, is_active FROM users WHERE id = ?").get(ownerId) as
    | { role: string; is_active: number }
    | undefined;
  if (!u || u.is_active !== 1 || (u.role !== "owner" && u.role !== "admin")) {
    throw badRequest("Owner must be an active owner or admin account");
  }
}

export function createIssue(
  actor: AuthUser,
  input: { title: string; description: string; severity: Severity; owner_id: string; due_date: string }
): Issue {
  assertAssignableOwner(input.owner_id);
  const id = crypto.randomUUID();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO issues (id, title, description, severity, owner_id, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.title, input.description, input.severity, input.owner_id, input.due_date, actor.id);
    recordAudit(actor, "issue.created", "issue", id, {
      title: input.title,
      severity: input.severity,
      owner_id: input.owner_id,
      due_date: input.due_date,
    });
  })();

  return getIssue(id);
}

type Patch = Partial<{
  title: string;
  description: string;
  severity: Severity;
  owner_id: string;
  due_date: string;
}>;

// Column names come from this fixed list, never from user input
const EDITABLE = ["title", "description", "severity", "owner_id", "due_date"] as const;

export function updateIssue(actor: AuthUser, id: string, patch: Patch): Issue {
  const current = getIssue(id);

  if (actor.role !== "admin") {
    if (current.owner_id !== actor.id) throw forbidden("You can only edit issues you own");
    if (Object.keys(patch).some((k) => k !== "description")) {
      throw forbidden("Only an admin can change these fields");
    }
    if (current.status === "in_review" || current.status === "completed") {
      throw conflict("This issue is locked while it is under review or completed");
    }
  }
  if (patch.owner_id) assertAssignableOwner(patch.owner_id);

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const col of EDITABLE) {
    const next = patch[col];
    if (next !== undefined && next !== current[col]) {
      changes[col] = { from: current[col], to: next };
      sets.push(`${col} = ?`);
      params.push(next);
    }
  }
  if (sets.length === 0) return current; // nothing actually changed

  db.transaction(() => {
    db.prepare(`UPDATE issues SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      ...params,
      id
    );
    recordAudit(actor, "issue.updated", "issue", id, changes);
  })();

  return getIssue(id);
}

export type Action = "start" | "request_review" | "request_revision" | "complete" | "reopen";

const ACTIONS: Record<
  Action,
  { from: Status; to: Status; adminOnly: boolean; commentRequired: boolean; kind: CommentKind | null }
> = {
  start:            { from: "open",        to: "in_progress", adminOnly: false, commentRequired: false, kind: null },
  request_review:   { from: "in_progress", to: "in_review",   adminOnly: false, commentRequired: false, kind: "review_requested" },
  request_revision: { from: "in_review",   to: "in_progress", adminOnly: true,  commentRequired: true,  kind: "revision_requested" },
  complete:         { from: "in_review",   to: "completed",   adminOnly: true,  commentRequired: false, kind: "approved" },
  reopen:           { from: "completed",   to: "in_progress", adminOnly: true,  commentRequired: true,  kind: "reopened" },
};

// Also used later when a human approves a pending action: the approver is the actor
export function applyAction(actor: AuthUser, id: string, action: Action, note?: string): Issue {
  const rule = ACTIONS[action];
  const issue = getIssue(id);
  const isOwner = issue.owner_id === actor.id;
  const body = (note ?? "").trim();

  if (rule.adminOnly) {
    if (actor.role !== "admin") throw forbidden("Only an admin can do this");
    if (isOwner) throw forbidden("You cannot review an issue you own");
  } else if (actor.role !== "admin" && !isOwner) {
    throw forbidden("You can only change the status of issues you own");
  }

  if (issue.status !== rule.from) {
    throw conflict(`This action needs the issue to be ${rule.from}, but it is ${issue.status}`);
  }
  if (rule.commentRequired && body.length === 0) {
    throw badRequest("A comment is required for this action");
  }
  if (action === "complete" && issue.evidence_count === 0) {
    throw conflict("Add at least one piece of evidence before completing this issue");
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE issues
       SET status = ?, updated_at = CURRENT_TIMESTAMP,
           completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = ?`
    ).run(rule.to, rule.to, id);

    const commentId = rule.kind ? insertComment(id, actor.id, rule.kind, body) : null;
    recordAudit(actor, `issue.${action}`, "issue", id, {
      from: issue.status,
      to: rule.to,
      ...(commentId ? { comment_id: commentId } : {}),
    });
  })();

  return getIssue(id);
}