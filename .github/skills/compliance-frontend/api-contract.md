# API contract (backend at http://localhost:3000)

Auth header on every call except login and health: `Authorization: Bearer <token>`. Use `api<T>()` from `lib/api.ts`, which adds it.
Timestamps are UTC strings like `2026-11-12 04:36:24`. Dates are `YYYY-MM-DD`. IDs are UUIDs.

## Errors (every non-2xx)
`{ "error": { "code", "message", "details"? } }`
- 400 `VALIDATION_ERROR` with `details: [{ path, message }]` (field errors), also `BAD_REQUEST`, `BAD_JSON`
- 401 `UNAUTHORIZED` (no, bad, or expired token; deactivated user). 403 `FORBIDDEN`. 404 `NOT_FOUND`
- 409 `CONFLICT` (wrong status, duplicate, locked, already decided). 429 `RATE_LIMITED`. 500 `INTERNAL_ERROR`

## Auth
- `POST /auth/login` body `{ email, password }` -> `{ token, user: { id, email, name, role } }`. 401 on any failure. 429 after 10 failed attempts in 15 minutes.
- `GET /auth/me` -> `{ user }`

## Dashboard (admin, owner, auditor)
`GET /dashboard` -> `{ generated_at, totals: { all, active, open, in_progress, in_review, completed, overdue, due_soon }, active_by_severity: { critical, high, medium, low }, overdue_issues: [{ id, title, severity, status, due_date, owner_name, days_overdue }] (top 5), pending_approvals }`
`active` = not completed (the "Open" card). `overdue` = not completed and past due.

## Issues
Issue: `{ id, title, description, severity, status, owner_id, owner_name, due_date, created_by, created_at, updated_at, completed_at | null, is_overdue, evidence_count }`
severity: `low | medium | high | critical`. status: `open | in_progress | in_review | completed`.

- `GET /issues` (all roles). Query, all optional: `status`, `severity`, `owner_id`, `overdue=true|false`, `search` (1-100 chars), `sort=due_date|created_at|updated_at|severity` (default due_date), `order=asc|desc` (default asc), `page` (default 1), `limit` (1-100, default 20) -> `{ issues, page, limit, total }`
- `GET /issues/:id` -> `{ issue }`
- `POST /issues` (admin) body `{ title (3-200), description? (max 5000), severity, owner_id (an active owner or admin), due_date }` -> 201 `{ issue }`
- `PATCH /issues/:id` (admin; owner on own issue) body: any of `title, description, severity, owner_id, due_date`, at least one, no other keys. Owners may send only `description`, and not while the issue is in_review or completed (409). -> `{ issue }`

### Workflow actions
`POST /issues/:id/<action>` body `{ comment? (max 2000) }` -> `{ issue }`. Allowed for admin, and for the owner where noted.
| action | from -> to | who | notes |
|---|---|---|---|
| `start` | open -> in_progress | owner of the issue, admin | |
| `request-review` | in_progress -> in_review | owner of the issue, admin | locks the owner out of edits |
| `request-revision` | in_review -> in_progress | admin, not the issue's owner | comment required (400 without) |
| `complete` | in_review -> completed | admin, not the issue's owner | needs at least 1 evidence (409) |
| `reopen` | completed -> in_progress | admin, not the issue's owner | comment required |
Wrong current status -> 409 with a readable message. Not allowed -> 403.

### Comments
Comment: `{ id, issue_id, author_id, author_name, author_role, kind, body, created_at }`. kind: `comment | review_requested | revision_requested | approved | reopened`
- `GET /issues/:id/comments` (all roles) -> `{ comments }` oldest first
- `POST /issues/:id/comments` (admin; owner on own issue; auditor gets 403) body `{ body (1-2000) }` -> 201 `{ comment }`

### Evidence (links only)
Evidence: `{ id, issue_id, kind: "link", reference, note, uploaded_by, uploaded_by_name, created_at }`
- `GET /issues/:id/evidence` (all roles) -> `{ evidence }`
- `POST /issues/:id/evidence` (admin; owner on own issue unless in_review or completed) body `{ reference (http or https URL, no credentials, max 2048), note? (max 500) }`, no other keys -> 201 `{ evidence }`. 409 if duplicate link or locked.

## Pending actions (agent proposals)
PendingAction: `{ id, issue_id, issue_title, action_type, payload: { comment?, severity? }, rationale, requested_by, requested_by_name, status: "pending" | "approved" | "rejected", decided_by, decided_by_name, decided_at, decision_note, created_at }`
action_type: `start | request_review | request_revision | complete | reopen | update_severity`
- `GET /pending-actions` (all roles). Query: `status`, `issue_id`, `page`, `limit` (default 20, max 100) -> `{ pending_actions, page, limit, total }` newest first
- `GET /pending-actions/:id` -> `{ pending_action }`
- `POST /pending-actions` is for the agent only. The frontend never calls it.
- `POST /pending-actions/:id/approve` (admin) body `{ note? (max 500) }` -> `{ pending_action, issue }`. 409 if already decided or the issue changed since.
- `POST /pending-actions/:id/reject` (admin) body `{ note }` (required, 1-500) -> `{ pending_action }`

## Users (admin only)
User: `{ id, email, name, role, is_active, created_at }`. The list includes the `agent` account: show it, but offer no actions on it.
- `GET /users` -> `{ users }`
- `POST /users` body `{ email, name (1-100), role: "admin" | "owner" | "auditor", password (12-72 chars) }` -> 201 `{ user }`. 409 if the email exists.
- `PATCH /users/:id/role` body `{ role }` -> `{ user }`. 403 on your own account, 409 if it would remove the last active admin.
- `POST /users/:id/deactivate` and `POST /users/:id/reactivate` -> `{ user }`. 403 on yourself, 409 for the last active admin.

## Audit log (admin, auditor)
Entry: `{ id, created_at, actor_id, actor_email, actor_name, actor_type: "human" | "agent", action, entity_type: "issue" | "user", entity_id, details (object) }`
- `GET /audit`. Query, all optional: `entity_type`, `entity_id`, `actor_id`, `actor_type`, `action` (lowercase letters, dots, underscores), `from`, `to` (YYYY-MM-DD), `page` (default 1), `limit` (default 50, max 200) -> `{ entries, page, limit, total }` newest first
- Actions: `auth.login`, `user.created`, `user.role_changed`, `user.deactivated`, `user.reactivated`, `issue.created`, `issue.updated`, `issue.start`, `issue.request_review`, `issue.request_revision`, `issue.complete`, `issue.reopen`, `issue.commented`, `evidence.added`, `pending_action.proposed`, `pending_action.approved`, `pending_action.rejected`

## Health
`GET /health` (public) -> `{ status: "ok", time }`