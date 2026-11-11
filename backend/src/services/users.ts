import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../db/connection";
import type { AuthUser } from "../middleware/auth";
import type { Role } from "../middleware/permissions";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors";
import { recordAudit } from "./audit";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: number;
  created_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

// Explicit column list: password_hash and api_token_hash can never leak
const COLUMNS = "id, email, name, role, is_active, created_at";

const toPublic = (r: UserRow): PublicUser => ({ ...r, is_active: r.is_active === 1 });

function getRow(id: string): UserRow {
  const row = db.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`).get(id) as UserRow | undefined;
  if (!row) throw notFound("User not found");
  return row;
}

function activeAdminCount(): number {
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1")
    .get() as { n: number };
  return n;
}

export function listUsers(): PublicUser[] {
  const rows = db.prepare(`SELECT ${COLUMNS} FROM users ORDER BY created_at, email`).all() as UserRow[];
  return rows.map(toPublic);
}

export async function createUser(
  actor: AuthUser,
  input: { email: string; name: string; role: Role; password: string }
): Promise<PublicUser> {
  const exists = db.prepare("SELECT 1 FROM users WHERE email = ?").get(input.email);
  if (exists) throw conflict("An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const id = crypto.randomUUID();

  try {
    db.transaction(() => {
      db.prepare(
        "INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)"
      ).run(id, input.email, input.name, passwordHash, input.role);
      // Never put the password (or its hash) in the audit details
      recordAudit(actor, "user.created", "user", id, { email: input.email, role: input.role });
    })();
  } catch (err) {
    if ((err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw conflict("An account with this email already exists"); // two requests raced
    }
    throw err;
  }

  return toPublic(getRow(id));
}

export function changeRole(actor: AuthUser, id: string, role: Role): PublicUser {
  const target = getRow(id);

  if (target.id === actor.id) throw forbidden("You cannot change your own role");
  if (target.role === "agent") throw badRequest("The agent account's role cannot be changed");
  if (target.role === role) return toPublic(target); // nothing to do

  if (target.role === "admin" && target.is_active === 1 && activeAdminCount() <= 1) {
    throw conflict("Cannot remove the last active admin");
  }

  db.transaction(() => {
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
    recordAudit(actor, "user.role_changed", "user", id, { from: target.role, to: role });
  })();

  return toPublic(getRow(id));
}

export function setActive(actor: AuthUser, id: string, active: boolean): PublicUser {
  const target = getRow(id);

  if (!active) {
    if (target.id === actor.id) throw forbidden("You cannot deactivate your own account");
    if (target.role === "admin" && target.is_active === 1 && activeAdminCount() <= 1) {
      throw conflict("Cannot deactivate the last active admin");
    }
  }
  if ((target.is_active === 1) === active) return toPublic(target); // already in that state

  db.transaction(() => {
    db.prepare("UPDATE users SET is_active = ? WHERE id = ?").run(active ? 1 : 0, id);
    recordAudit(actor, active ? "user.reactivated" : "user.deactivated", "user", id, {
      email: target.email,
    });
  })();

  return toPublic(getRow(id));
}