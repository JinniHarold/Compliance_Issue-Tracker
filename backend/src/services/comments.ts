import crypto from "node:crypto";
import { db } from "../db/connection";
import type { AuthUser } from "../middleware/auth";
import { forbidden, notFound } from "../utils/errors";
import { recordAudit } from "./audit";

export type CommentKind =
  | "comment" | "review_requested" | "revision_requested" | "approved" | "reopened";

export interface IssueComment {
  id: string;
  issue_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  kind: CommentKind;
  body: string;
  created_at: string;
}

const SELECT = `
  SELECT c.id, c.issue_id, c.author_id, u.name AS author_name, u.role AS author_role,
         c.kind, c.body, c.created_at
  FROM issue_comments c JOIN users u ON u.id = c.author_id`;

// Caller wraps this in its own transaction
export function insertComment(issueId: string, authorId: string, kind: CommentKind, body: string): string {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO issue_comments (id, issue_id, author_id, kind, body) VALUES (?, ?, ?, ?, ?)"
  ).run(id, issueId, authorId, kind, body);
  return id;
}

function issueOwner(issueId: string): string {
  const row = db.prepare("SELECT owner_id FROM issues WHERE id = ?").get(issueId) as
    | { owner_id: string }
    | undefined;
  if (!row) throw notFound("Issue not found");
  return row.owner_id;
}

export function listComments(issueId: string): IssueComment[] {
  issueOwner(issueId); // 404 if the issue doesn't exist
  return db
    .prepare(`${SELECT} WHERE c.issue_id = ? ORDER BY c.created_at, c.rowid`)
    .all(issueId) as IssueComment[];
}

export function addComment(actor: AuthUser, issueId: string, body: string): IssueComment {
  const ownerId = issueOwner(issueId);
  if (actor.role === "owner" && ownerId !== actor.id) {
    throw forbidden("You can only comment on issues you own");
  }

  const id = db.transaction(() => {
    const cid = insertComment(issueId, actor.id, "comment", body);
    recordAudit(actor, "issue.commented", "issue", issueId, { comment_id: cid });
    return cid;
  })();

  return db.prepare(`${SELECT} WHERE c.id = ?`).get(id) as IssueComment;
}