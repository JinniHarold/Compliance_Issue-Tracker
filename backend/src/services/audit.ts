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