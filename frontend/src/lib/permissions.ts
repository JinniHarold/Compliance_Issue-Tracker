import type { Role } from "./types";

// Cosmetic only: this decides what to SHOW. The API enforces the real permissions.
// Rules about a specific record (for example "is this my issue?") are checked on each screen.
export type Action =
  | "issue:create"
  | "issue:edit-fields"
  | "issue:review"
  | "users:manage"
  | "approvals:decide"
  | "audit:read";

const MATRIX: Record<Action, Role[]> = {
  "issue:create": ["admin"],
  "issue:edit-fields": ["admin"],
  "issue:review": ["admin"],
  "users:manage": ["admin"],
  "approvals:decide": ["admin"],
  "audit:read": ["admin", "auditor"],
};

export const can = (role: Role | undefined, action: Action): boolean =>
  !!role && MATRIX[action].includes(role);
