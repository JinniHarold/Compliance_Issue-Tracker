import crypto from "node:crypto";
import { db } from "../db/connection";
import type { AuthUser } from "../middleware/auth";
import { conflict, forbidden } from "../utils/errors";
import { recordAudit } from "./audit";
import { getIssue } from "./issues";

export interface Evidence {
  id: string;
  issue_id: string;
  kind: "link" | "file";
  reference: string;
  note: string;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
}

const SELECT = `
  SELECT e.id, e.issue_id, e.kind, e.reference, e.note, e.uploaded_by,
         u.name AS uploaded_by_name, e.created_at
  FROM evidence e JOIN users u ON u.id = e.uploaded_by`;

export function listEvidence(issueId: string): Evidence[] {
  getIssue(issueId); // throws 404 if the issue doesn't exist
  return db
    .prepare(`${SELECT} WHERE e.issue_id = ? ORDER BY e.created_at, e.rowid`)
    .all(issueId) as Evidence[];
}

export function addLinkEvidence(
  actor: AuthUser,
  issueId: string,
  input: { reference: string; note: string }
): Evidence {
  const issue = getIssue(issueId);

  if (actor.role !== "admin") {
    if (issue.owner_id !== actor.id) throw forbidden("You can only add evidence to issues you own");
    if (issue.status === "in_review" || issue.status === "completed") {
      throw conflict("This issue is locked while it is under review or completed");
    }
  }

  const duplicate = db
    .prepare("SELECT 1 FROM evidence WHERE issue_id = ? AND reference = ?")
    .get(issueId, input.reference);
  if (duplicate) throw conflict("This link is already attached to the issue");

  const id = crypto.randomUUID();
  db.transaction(() => {
    db.prepare(
      "INSERT INTO evidence (id, issue_id, kind, reference, note, uploaded_by) VALUES (?, ?, 'link', ?, ?, ?)"
    ).run(id, issueId, input.reference, input.note, actor.id);
    recordAudit(actor, "evidence.added", "issue", issueId, {
      evidence_id: id,
      kind: "link",
      reference: input.reference,
    });
  })();

  return db.prepare(`${SELECT} WHERE e.id = ?`).get(id) as Evidence;
}