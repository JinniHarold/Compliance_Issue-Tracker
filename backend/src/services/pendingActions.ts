import crypto from "node:crypto";
import { db } from "../db/connection";
import type { AuthUser } from "../middleware/auth";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors";
import { recordAudit } from "./audit";
import { ACTIONS, applyAction, getIssue, updateIssue, type Action, type Severity } from "./issues";

export type PendingType = Action | "update_severity";
export type PendingStatus = "pending" | "approved" | "rejected";

interface Row {
  id: string;
  issue_id: string;
  issue_title: string;
  action_type: PendingType;
  payload: string;
  rationale: string;
  requested_by: string;
  requested_by_name: string;
  status: PendingStatus;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface PendingAction extends Omit<Row, "payload"> {
  payload: { comment?: string; severity?: Severity };
}

const SELECT = `
  SELECT p.id, p.issue_id, i.title AS issue_title, p.action_type, p.payload, p.rationale,
         p.requested_by, r.name AS requested_by_name, p.status,
         p.decided_by, d.name AS decided_by_name, p.decided_at, p.decision_note, p.created_at
  FROM pending_actions p
  JOIN issues i ON i.id = p.issue_id
  JOIN users r ON r.id = p.requested_by
  LEFT JOIN users d ON d.id = p.decided_by`;

function toPending(row: Row): PendingAction {
  let payload: PendingAction["payload"] = {};
  try {
    payload = JSON.parse(row.payload);
  } catch {
    /* malformed payload is treated as empty */
  }
  return { ...row, payload };
}

export function getPending(id: string): PendingAction {
  const row = db.prepare(`${SELECT} WHERE p.id = ?`).get(id) as Row | undefined;
  if (!row) throw notFound("Pending action not found");
  return toPending(row);
}

export function listPending(f: { status?: PendingStatus; issue_id?: string; page: number; limit: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.status) { where.push("p.status = ?"); params.push(f.status); }
  if (f.issue_id) { where.push("p.issue_id = ?"); params.push(f.issue_id); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { n } = db
    .prepare(`SELECT COUNT(*) AS n FROM pending_actions p ${whereSql}`)
    .get(...params) as { n: number };

  const rows = db
    .prepare(`${SELECT} ${whereSql} ORDER BY p.created_at DESC, p.rowid DESC LIMIT ? OFFSET ?`)
    .all(...params, f.limit, (f.page - 1) * f.limit) as Row[];

  return { pending_actions: rows.map(toPending), page: f.page, limit: f.limit, total: n };
}

export function proposeAction(
  actor: AuthUser,
  input: { issue_id: string; action_type: PendingType; rationale: string; comment?: string; severity?: Severity }
): PendingAction {
  const issue = getIssue(input.issue_id);

  if (input.action_type === "update_severity") {
    if (issue.severity === input.severity) throw badRequest(`Issue already has severity ${issue.severity}`);
  } else {
    const from = ACTIONS[input.action_type].from;
    if (issue.status !== from) {
      throw conflict(`This action needs the issue to be ${from}, but it is ${issue.status}`);
    }
  }

  const duplicate = db
    .prepare("SELECT 1 FROM pending_actions WHERE issue_id = ? AND action_type = ? AND status = 'pending'")
    .get(input.issue_id, input.action_type);
  if (duplicate) throw conflict("A pending proposal of this type already exists for this issue");

  const payload =
    input.action_type === "update_severity"
      ? { severity: input.severity }
      : input.comment
        ? { comment: input.comment }
        : {};

  const id = crypto.randomUUID();
  try {
    db.transaction(() => {
      db.prepare(
        `INSERT INTO pending_actions (id, issue_id, action_type, payload, rationale, requested_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, input.issue_id, input.action_type, JSON.stringify(payload), input.rationale, actor.id);
      recordAudit(actor, "pending_action.proposed", "issue", input.issue_id, {
        pending_action_id: id,
        action_type: input.action_type,
      });
    })();
  } catch (err) {
    if ((err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw conflict("A pending proposal of this type already exists for this issue");
    }
    throw err;
  }

  return getPending(id);
}

function loadDecidable(actor: AuthUser, id: string): PendingAction {
  const pa = getPending(id);
  if (pa.status !== "pending") throw conflict(`This proposal was already ${pa.status}`);
  if (pa.requested_by === actor.id) throw forbidden("You cannot decide your own proposal");
  return pa;
}

// Approval runs the real action as the approving human, in ONE transaction:
// if the action fails (for example the issue changed since the proposal), nothing is saved.
export function approvePending(actor: AuthUser, id: string, note?: string): PendingAction {
  const pa = loadDecidable(actor, id);

  db.transaction(() => {
    const res = db
      .prepare(
        `UPDATE pending_actions
         SET status = 'approved', decided_by = ?, decided_at = CURRENT_TIMESTAMP, decision_note = ?
         WHERE id = ? AND status = 'pending'`
      )
      .run(actor.id, note ?? null, id);
    if (res.changes !== 1) throw conflict("This proposal was already decided");

    if (pa.action_type === "update_severity") {
      if (!pa.payload.severity) throw badRequest("Proposal has no severity");
      updateIssue(actor, pa.issue_id, { severity: pa.payload.severity });
    } else {
      applyAction(actor, pa.issue_id, pa.action_type, pa.payload.comment);
    }

    recordAudit(actor, "pending_action.approved", "issue", pa.issue_id, {
      pending_action_id: id,
      action_type: pa.action_type,
      requested_by: pa.requested_by,
    });
  })();

  return getPending(id);
}

export function rejectPending(actor: AuthUser, id: string, note: string): PendingAction {
  const pa = loadDecidable(actor, id);

  db.transaction(() => {
    const res = db
      .prepare(
        `UPDATE pending_actions
         SET status = 'rejected', decided_by = ?, decided_at = CURRENT_TIMESTAMP, decision_note = ?
         WHERE id = ? AND status = 'pending'`
      )
      .run(actor.id, note, id);
    if (res.changes !== 1) throw conflict("This proposal was already decided");

    recordAudit(actor, "pending_action.rejected", "issue", pa.issue_id, {
      pending_action_id: id,
      action_type: pa.action_type,
      requested_by: pa.requested_by,
    });
  })();

  return getPending(id);
}