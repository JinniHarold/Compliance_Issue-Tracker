import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../utils/errors";

export type Role = "admin" | "owner" | "auditor" | "agent";

export type Permission =
  | "dashboard:read"
  | "issues:read"
  | "issues:create"
  | "issues:update"
  | "comments:add"
  | "evidence:add"
  | "pending:propose"
  | "pending:decide"
  | "audit:read"
  | "users:manage";

const PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    "dashboard:read", "issues:read", "issues:create", "issues:update", "comments:add",
    "evidence:add", "pending:decide", "audit:read", "users:manage",
  ],
  owner: ["dashboard:read", "issues:read", "issues:update", "comments:add", "evidence:add"],
  auditor: ["dashboard:read", "issues:read", "audit:read"],
  // The agent can read, comment, and PROPOSE. It can never decide, and it cannot add evidence.
  agent: ["dashboard:read", "issues:read", "comments:add", "pending:propose", "audit:read"],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!can(req.user.role, permission)) return next(forbidden());
    next();
  };
}