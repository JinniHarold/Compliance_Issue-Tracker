import crypto from "node:crypto";
import { db } from "../db/connection";
import type { AuthUser } from "../middleware/auth";

export function recordAudit(
  actor: AuthUser,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {}
) {
  db.prepare(
    `INSERT INTO audit_logs (id, actor_id, actor_type, action, entity_type, entity_id, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    actor.id,
    actor.role === "agent" ? "agent" : "human",
    action,
    entityType,
    entityId,
    JSON.stringify(details)
  );
}

export interface AuditEntry {
  id: string;
  created_at: string;
  actor_id: string;
  actor_email: string;
  actor_name: string;
  actor_type: "human" | "agent";
  action: string;
  entity_type: string;
  entity_id: string;
  details: unknown;
}

export interface AuditFilters {
  entity_type?: string;
  entity_id?: string;
  actor_id?: string;
  actor_type?: "human" | "agent";
  action?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

interface AuditRow extends Omit<AuditEntry, "details"> {
  details: string;
}

function parseDetails(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function listAudit(f: AuditFilters) {
  const where: string[] = [];
  const params: unknown[] = [];

  if (f.entity_type) { where.push("a.entity_type = ?"); params.push(f.entity_type); }
  if (f.entity_id) { where.push("a.entity_id = ?"); params.push(f.entity_id); }
  if (f.actor_id) { where.push("a.actor_id = ?"); params.push(f.actor_id); }
  if (f.actor_type) { where.push("a.actor_type = ?"); params.push(f.actor_type); }
  if (f.action) { where.push("a.action = ?"); params.push(f.action); }
  if (f.from) { where.push("date(a.created_at) >= ?"); params.push(f.from); }
  if (f.to) { where.push("date(a.created_at) <= ?"); params.push(f.to); }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { n } = db
    .prepare(`SELECT COUNT(*) AS n FROM audit_logs a ${whereSql}`)
    .get(...params) as { n: number };

  const rows = db
    .prepare(
      `SELECT a.id, a.created_at, a.actor_id, u.email AS actor_email, u.name AS actor_name,
              a.actor_type, a.action, a.entity_type, a.entity_id, a.details
       FROM audit_logs a JOIN users u ON u.id = a.actor_id
       ${whereSql}
       ORDER BY a.created_at DESC, a.rowid DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, f.limit, (f.page - 1) * f.limit) as AuditRow[];

  return {
    entries: rows.map((r) => ({ ...r, details: parseDetails(r.details) })),
    page: f.page,
    limit: f.limit,
    total: n,
  };
}