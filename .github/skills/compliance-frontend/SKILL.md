---
name: compliance-frontend
description: Rules for building or changing the React frontend of the Compliance Issue Tracker in the frontend/ folder, including screens, role-based navigation, API calls, styling, responsive layout, and security. Use for any UI screen, component, route, form, or API call in frontend/.
---

# Compliance Tracker frontend rules

## Stack (do not add libraries unless asked)
React + Vite + TypeScript (strict) + Tailwind + React Router. No UI kits, no CSS files, no state libraries.

## Token and effort rules
- Read only the files the task needs. Never open `node_modules`, `dist`, lockfiles, or `backend/data`.
- Edit existing files and reuse existing pieces (`lib/api.ts`, `AuthContext`, `Badges`, `Layout`) before creating new ones.
- Show only changed files or changed parts. No long explanations, no recap of the task.
- Do not create READMEs, docs, or tests unless asked.
- If something is ambiguous, pick the simplest reasonable option and state it in one line. Do not ask several questions.

## Layout
`src/lib/api.ts` (the only place that calls fetch), `src/lib/types.ts`, `src/lib/permissions.ts`, `src/auth/`, `src/components/`, `src/pages/`.

## API
- Call the backend only through `api<T>(path, { method, body })`. Never use `fetch` directly. Tokens are handled only by `tokenStore`.
- Add response types to `lib/types.ts`. No `any`.
- Catch `ApiError`: show `message` in an element with `role="alert"`, and map `details[]` (`path`, `message`) to the matching form fields.
- Every list or page has loading, empty, and error states.
- API reference: see [api-contract.md](./api-contract.md). Do not read backend route files unless the contract is missing something.

## TypeScript config limits
Use `import type` for types. No enums and no constructor parameter properties. Use union types instead.

## Roles and navigation
- Roles: admin, owner, auditor. The agent role never logs in.
- Hiding controls is cosmetic. The server enforces permissions, so UI checks go through one helper in `lib/permissions.ts`.
- Navbar: Admin = Dashboard, Issues, Approvals, Users, Audit Logs. Owner = Dashboard, Issues, Approvals. Auditor = Dashboard, Issues, Approvals, Audit Logs.
- Routes: `/login`, `/` (dashboard summary only), `/issues`, `/issues/:id`, `/approvals`, `/users` (admin), `/audit` (admin, auditor). A role that opens a route it cannot use sees a friendly "no access" page.

## Issue workflow (buttons)
Statuses: open, in_progress, in_review, completed.
- Start (open) and Request review (in_progress): the issue's owner, or an admin.
- Send back (in_review, comment required), Complete (in_review), Reopen (completed, comment required): admin only, and never on an issue the admin owns.
- Owners cannot edit or add evidence while the issue is in_review or completed.
- Only admins create issues and change title, severity, owner, or due date.
- Approve and Reject on proposals: admin only. Rejecting requires a note.

## UI
- Tailwind utility classes only. Mobile-first. Tables become stacked cards below the `md` breakpoint.
- Forms: visible labels, field-level errors, disabled button while submitting.
- Confirm destructive or hard-to-undo actions (deactivate user, complete, reject).
- Use `SeverityBadge` and `StatusBadge`. Dates are `YYYY-MM-DD` from the API, shown in a readable local format.
- Summary cards on the dashboard link to filtered views (for example Overdue opens Issues filtered to overdue).

## Security
- Never use `dangerouslySetInnerHTML`. Render all server text as plain text.
- Evidence links render only when they start with http or https, with `target="_blank"` and `rel="noopener noreferrer"`.
- No secrets in code and no token logging.

## Done means
`npm run build` passes with no TypeScript errors, and the screen was checked in the browser as admin, owner, and auditor.