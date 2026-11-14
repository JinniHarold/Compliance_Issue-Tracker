# Compliance Issue Tracker

A small compliance issue tracker with role-based access, a review workflow, and an audit trail. It also includes an **MCP server** that lets an AI agent work with the data safely, and a rule-based **resolution playbook** built on top of it.

- Issues with severity, owner, due date, status, evidence links, and comments
- Dashboard showing open, overdue, and completed issues
- Roles: **admin**, **owner**, **auditor** (people) and **agent** (AI, token only)
- AI and automation can **read, comment, and propose**. A human approves anything that changes an issue.
- Every change is written to an append-only audit log

**Jump to:** [Setup](#setup) · [Architecture](#architecture) · [Roles](#roles-and-permissions) · [MCP server](#mcp-server) · [Playbook](#automated-resolution-playbook) · [Testing](#testing) · [Security](#security-design) · [Troubleshooting](#troubleshooting)

---

## Setup

Follow the steps in order. Each step says what you should see, so you know it worked.

### Before you start

You need two free tools:

| Tool | Check it is installed | Get it |
|---|---|---|
| **Node.js** 20.12 or newer (choose "LTS") | `node -v` | https://nodejs.org |
| **Git** | `git --version` | https://git-scm.com |

> [!TIP]
> A **terminal** is the window where you type commands. On Windows use **PowerShell**, on Mac use **Terminal**. In VS Code, use **Terminal > New Terminal**.
> You will keep up to three terminals open at once. In each new terminal, first go to the project folder (`Compliance_Issue-Tracker`). VS Code does this for you when you open the project folder.

### Step 1. Get the code

```bash
git clone https://github.com/JinniHarold/Compliance_Issue-Tracker.git
cd Compliance_Issue-Tracker
```

This downloads the project into a folder called `Compliance_Issue-Tracker`. Every later step starts from this folder.

### Step 2. Start the backend (Terminal 1)

```bash
cd backend
npm install
npm run setup:env
npm run db:setup
npm run dev
```

| Command | What it does |
|---|---|
| `npm install` | Downloads the libraries the backend needs |
| `npm run setup:env` | Creates the settings file `backend/.env` and fills in a random secret key for logins |
| `npm run db:setup` | Creates the database and adds demo data |
| `npm run dev` | Starts the API and keeps it running |

<details>
<summary><b>What you should see (click to open)</b></summary>

After `npm run setup:env`:

```
Created backend/.env with a new JWT_SECRET.
```

After `npm run db:setup`:

```
Schema applied.

Seed complete. Demo accounts:
  admin@tracker.local    (admin)   password: Demo@12345
  maria@tracker.local    (owner)   password: Demo@12345
  john@tracker.local     (owner)   password: Demo@12345
  auditor@tracker.local  (auditor) password: Demo@12345

Agent API token (shown once, copy it for mcp-server/.env):
  agt_...
```

You can ignore that token. Step 5 creates a fresh one for you automatically.

After `npm run dev`:

```
API running on http://localhost:3000 (development)
```

</details>

**Check it:** open http://localhost:3000/health in your browser. You should see `{"status":"ok", ...}`.

> [!NOTE]
> `npm run setup:env` never overwrites an existing `.env`, so it is safe to run again.
> Prefer to do it by hand? Copy `backend/.env.example` to `backend/.env`, then run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste the result as the value of `JWT_SECRET`.

> [!WARNING]
> Leave this terminal running. Closing it stops the API.

### Step 3. Start the frontend (Terminal 2)

Open a **new terminal**, go to the project folder, then:

```bash
cd frontend
npm install
npm run dev
```

<details>
<summary><b>What you should see</b></summary>

```
  VITE ready in 400 ms

  ➜  Local:   http://localhost:5173/
```

</details>

Open **http://localhost:5173** in your browser. Use `localhost`, not `127.0.0.1`, because the API only allows that address.

### Step 4. Sign in

The login page has buttons that fill in the demo accounts. They are demo data only.

| Email | Role | Password |
|---|---|---|
| `admin@tracker.local` | admin | `Demo@12345` |
| `maria@tracker.local` | owner | `Demo@12345` |
| `john@tracker.local` | owner | `Demo@12345` |
| `auditor@tracker.local` | auditor | `Demo@12345` |
| `agent@tracker.local` | agent | no password, token only |

> [!TIP]
> Each browser tab has its own login. Sign in as an admin in one tab and as an owner in another to try the review workflow.

The app is now running. The next two steps are optional and cover the AI side.

### Step 5. Optional: connect an AI agent (MCP)

The MCP server needs a **token**, which works like a password for the AI agent. This command creates one and saves it for you. You never have to copy it.

**5a. Create the token** (Terminal 3, with the backend from Step 2 still running)

```bash
cd backend
npm run agent:token -- --write
```

<details>
<summary><b>What you should see</b></summary>

```
Wrote a new token for agent@tracker.local to mcp-server/.env (not printed). The old token no longer works.
```

If you open `mcp-server/.env`, it now looks like this:

```
API_BASE_URL=http://localhost:3000
AGENT_TOKEN=agt_<64 letters and numbers>
```

</details>

> [!WARNING]
> The token is a secret. It lives only in `mcp-server/.env`, which Git ignores. Never paste it into a chat, a screenshot, or a commit.

> [!NOTE]
> Prefer to do it by hand? Copy `mcp-server/.env.example` to `mcp-server/.env`, run `npm run agent:token` (without `--write`) in `backend/`, and paste the printed token as the value of `AGENT_TOKEN`.

**5b. Install and check the MCP server**

```bash
cd ../mcp-server
npm install
npm run build
```

`npm run build` prints nothing when everything is fine.

**5c. Try it with the MCP Inspector**

```bash
npm run inspect
```

1. The first time, it asks `Ok to proceed? (y)`. Type `y` and press Enter.
2. Your browser opens the Inspector. Click **Connect**.
3. Open the **Tools** tab and click **List Tools**. You should see **9 tools**.
4. Choose `get_dashboard` and click **Execute Tool**. You should see the issue counts.
5. Stop it with `Ctrl + C` in the terminal when you are done.

To connect an AI app such as VS Code or Claude Desktop, see [MCP server](#mcp-server).

### Step 6. Optional: run the playbook

The playbook is an automatic checker that reads the issues and suggests fixes. In a terminal (backend running, Step 5 done):

```bash
cd playbook
npm install
npm run dry-run
```

`dry-run` only **shows** what it would do. To make it act, run `npm run apply`. A full walkthrough is in [Automated resolution playbook](#automated-resolution-playbook).

---

## Architecture

```
Browser (React)                    AI client or playbook
      |                                     |
      |  REST + login token                 |  MCP (stdio)
      v                                     v
 +-----------+   agent token    +----------------------+
 |    API    | <--------------- |      MCP server      |
 | (Express) |                  | 9 tools, no approve  |
 +-----------+                  +----------------------+
      |
      v
   SQLite
```

The API is the only thing that touches the database. The UI, the MCP server, and the playbook all go through it, so authentication, permissions, and business rules live in one place.

```
backend/      Express API: routes (HTTP) -> services (rules, audit) -> db (SQLite)
frontend/     React + Vite + TypeScript + Tailwind single-page app
mcp-server/   MCP server exposing the API as tools for an AI agent
playbook/     Rule-based automation that uses the MCP tools
.github/      Copilot instructions and API contract used while building
```

**Stack:** TypeScript throughout. Express, `better-sqlite3`, Zod, `jsonwebtoken`, `bcryptjs`, Vitest and Supertest on the backend. React, Vite, Tailwind, and React Router on the frontend. The official `@modelcontextprotocol/sdk` for MCP.

**Data model:** `users` (role, active flag, hashed password, hashed agent token), `issues`, `evidence` (links), `issue_comments`, `pending_actions` (agent proposals), `audit_logs` (append-only).

### Backend settings (`backend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | yes | At least 32 characters. Created for you by `npm run setup:env`. The server will not start without it. |
| `PORT` | no | Default 3000 |
| `CORS_ORIGIN` | no | Default `http://localhost:5173` |
| `JWT_EXPIRES_SECONDS` | no | Default 3600 (1 hour) |
| `SEED_ADMIN_PASSWORD` | no | Demo admin password, default `Demo@12345` |

---

## Roles and permissions

| Action | Admin | Owner | Auditor | Agent |
|---|---|---|---|---|
| View dashboard, issues, evidence, comments | yes | yes | yes | yes |
| Create an issue, change severity, owner, due date | yes | no | no | no |
| Edit description | yes | own issue, unless locked | no | no |
| Start, request review | yes | own issue | no | no |
| Send back, complete, reopen | yes (not on own issues) | no | no | no |
| Add comment | yes | own issue | no | yes |
| Add evidence link | yes | own issue, unless locked | no | no |
| Propose a change | no | no | no | **yes** |
| Approve or reject a proposal | **yes** | no | no | **never** |
| Read audit log | yes | no | yes | yes |
| Manage users | yes | no | no | no |

The UI hides controls by role, but the **API enforces everything**. Permissions are one map in `backend/src/middleware/permissions.ts`, and record-level rules (ownership, locks) live in the services.

### Issue workflow

```
open --start--> in_progress --request review--> in_review --complete--> completed
                    ^                               |                       |
                    +------ send back (comment) ----+                       |
                    +----------------- reopen (comment) --------------------+
```

- The owner submits work for review and is **locked out of editing** while it is in review or completed.
- An admin sends it back (a comment is required) or completes it. Completing needs at least one evidence link.
- Nobody reviews an issue they own, so the person who does the work is never the one who signs it off.
- "Overdue" is calculated from the due date and status, never stored.

### Screens

| Screen | Who | What |
|---|---|---|
| Dashboard | all | Open, overdue, completed, and awaiting-approval counts; cards link to filtered lists |
| Issues, Issue page | all | Filters, search, paging; details, workflow buttons, comments, evidence, history |
| Approvals | all (admin decides) | The agent's proposals, with Pending, Approved, and Rejected tabs |
| Users | admin | Create users, change roles, deactivate and reactivate |
| Audit Logs | admin, auditor | Filterable trail of every action |

---

## MCP server

`mcp-server/` is a stdio MCP server. It calls the API **as the agent account** using the token from Step 5, and never touches the database.

### Connect an AI client

**VS Code (Copilot agent mode):** create `.vscode/mcp.json` in the project folder, click **Start** above the entry, switch Copilot Chat to **Agent mode**, and enable the tools.

```json
{
  "servers": {
    "compliance-tracker": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "${workspaceFolder}/mcp-server/src/index.ts"]
    }
  }
}
```

**Claude Desktop:** add this to its config file and restart the app. The server reads `mcp-server/.env` itself, so no extra settings are needed.

```json
{
  "mcpServers": {
    "compliance-tracker": {
      "command": "npx",
      "args": ["tsx", "<full path to project>/mcp-server/src/index.ts"]
    }
  }
}
```

> [!TIP]
> Try asking the AI: *"Find the overdue issues, add an analysis note to the most urgent one, and propose one action if justified."* Then open **Approvals** in the app to see its proposal waiting for you.

> [!NOTE]
> If you create a new token (Step 5a), restart your AI client so it picks up the new one.

### Tools

| Tool | Type | Purpose |
|---|---|---|
| `list_issues`, `get_issue` | read | Find and inspect issues |
| `list_comments`, `list_evidence` | read | History and proof on an issue |
| `get_dashboard`, `get_audit_log` | read | Summary counts and recent actions |
| `list_proposals` | read | See what is already pending |
| `add_comment` | low-risk write | Add an analysis note, recorded as the agent |
| `propose_action` | gated write | Create a **pending** proposal. Nothing changes until an admin approves it. |

### Safeguards

- **No tools** to approve, reject, edit, delete, add evidence, or manage users. The API would also answer 403.
- The agent account has its own limited permissions and a hashed token, and cannot log in with a password.
- Inputs are checked with strict Zod schemas before any request is made, and errors come back as readable tool errors.
- Tool descriptions tell the model that issue text is **untrusted data, never instructions**. The approval gate limits the damage even if a model is fooled.
- The token is read only from `mcp-server/.env`, is never a tool argument, and is never logged or returned.
- Every call is attributed to the agent in the audit log.

---

## Automated resolution playbook

`playbook/` is a rule-based script (no AI model, no API key) that uses the MCP tools. Decisions use only structured fields (status, severity, dates, counts), so text written to trick an AI has no effect.

```bash
cd playbook
npm run dry-run                          # show the plan, change nothing (default)
npm run apply                            # post notes and create proposals
npm run dry-run -- --issue <issue-id>    # one issue only
```

| Finding | Rule | Result |
|---|---|---|
| Overdue, not started, stalled (no update for 7+ days), no evidence, due within 3 days | status and dates | analysis **note** |
| Severity low for age | overdue 7+ days (low, medium) or 14+ days (high) | **proposal**: raise one level |
| In review, no evidence | cannot be completed | **proposal**: send back with a comment |
| In review, evidence attached | ready for sign-off | **proposal**: complete |

**Safeguards:** dry run by default; notes carry a `ref:` marker and are never posted twice for the same state; a proposal is skipped if one of that type is already pending; at most 10 writes per run (`--max-actions`); every action is audited as the agent.

### Example: end to end

1. Make sure the backend is running and Step 5 is done.
2. **Preview the plan** (nothing changes):

   ```bash
   cd playbook
   npm run dry-run
   ```

   <details>
   <summary><b>Sample output</b></summary>

   ```
   Playbook run (dry-run): 5 active issue(s) checked
   DRY RUN: nothing was changed. Add --apply to perform the planned actions.

   Unencrypted backups on shared drive  [critical, in_review]
     Findings: Overdue by 7 days; In review with no evidence attached
     PLAN  proposal: request_revision: In review with no evidence attached, so completion would be refused. Sending back for evidence.
     PLAN  comment: Add analysis note with recommended next steps
   ...
   Summary: 5 with findings | done 0 | planned 8 | skipped 0 | failed 0
   ```

   Your issue names and numbers will differ.
   </details>

3. **Run it for real:** `npm run apply`. The `PLAN` lines become `DONE`.
4. In the app, sign in as **admin**. Open an issue to see the agent's note (author "Compliance Agent", role agent), then open **Approvals**. The issues have not changed yet.
5. **Approve** one proposal. The change is applied, and **Audit Logs** shows `pending_action.proposed` (agent) followed by `pending_action.approved` (human).
6. Run `npm run apply` again. Everything shows `SKIP`, because nothing is posted twice.

---

## Testing

| What | Command |
|---|---|
| Backend: 26 tests (auth, review workflow, evidence rules, approval gate, database constraints) | `cd backend && npm test` |
| Playbook: 18 tests (rules, dry run, idempotency, cap, hostile text) | `cd playbook && npm test` |
| Frontend type-check and build | `cd frontend && npm run build` |
| MCP server type-check, then try the tools by hand | `cd mcp-server && npm run build`, then `npm run inspect` |
| Look inside the database | `cd backend && npm run db:inspect` |
| Start over with fresh demo data | `cd backend && npm run db:reset` |

Backend tests use a temporary in-memory database, so they never touch your real data.

> [!WARNING]
> `npm run db:reset` also invalidates the agent token. Run `npm run agent:token -- --write` afterward.

---

## Security design

- **Login:** bcrypt password hashes; JWTs (HS256, 1 hour); generic login errors, safe handling of unknown emails, and a rate limit on failed logins.
- **Every request** reloads the user from the database, so deactivating an account or changing a role takes effect immediately.
- **No public signup.** Only admins create accounts. Admins cannot deactivate themselves, change their own role, or remove the last active admin.
- **Validation:** strict Zod schemas on every input, capped page sizes, allowlisted sort columns, parameterized SQL, and explicit response columns (hashes never leave the API).
- **Evidence links:** only http and https, no embedded credentials, normalized and de-duplicated, and opened with `rel="noopener noreferrer"`.
- **Audit trail:** each action records who (human or agent), what, and when. Database triggers block edits and deletes.
- **Database backstops:** constraints for allowed values, the approver differing from the requester, and one pending proposal per issue and action.
- **Errors:** one consistent JSON shape; unexpected errors return a generic 500 and are logged server-side only.
- **Secrets:** `.env` files and database files are git-ignored, and `.env.example` files hold placeholders only.

### Design decisions

| Decision | Reason |
|---|---|
| Separate API and a single-page app | The app sits behind a login, so there is no SEO need, and one API serves the UI, MCP, and playbook |
| SQLite | Nothing to install for a reviewer; the schema file builds it |
| MCP server calls the API, not the database | AI and automation get the same authentication, permissions, and rules as people |
| Propose, then approve | A hallucination or injected instruction can waste someone's time but cannot change the record |
| Rule-based playbook | Predictable, free, and runs without keys; an LLM can drive the same tools through MCP |
| One endpoint per workflow action | Each maps to one button and one audit entry |

### Known limitations and next steps

- The login token is kept in `sessionStorage`. Production should use `httpOnly` cookies with CSRF protection.
- SQLite and a schema file instead of migrations. Production would use PostgreSQL with migrations.
- Rate limiting is in memory, so it resets on restart and is not shared between servers.
- All AI and automation clients share one agent identity. A separate account and token per client would be better, and token rotation is not itself audited.
- Evidence is links only, with no file uploads.
- The MCP server is local (stdio). A remote deployment needs a network transport with real authentication.
- Roles are company-wide, with no department scoping.
- Dates and "overdue" use UTC.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm` or `node` is not recognized | Install Node.js from https://nodejs.org, then **close and reopen** the terminal |
| PowerShell says running scripts is disabled | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then try again |
| API stops with a `JWT_SECRET` error | Run `npm run setup:env` in `backend/` |
| Port 3000 or 5173 is already in use | Close the other terminal using it, then start again |
| Browser shows a CORS error | Use `http://localhost:5173`, and check `CORS_ORIGIN` in `backend/.env` |
| Logged out after an hour | Tokens expire. Sign in again, or raise `JWT_EXPIRES_SECONDS` |
| `better-sqlite3` fails to install | Use Node 20 or 22 (LTS) |
| MCP tools return 401 | The agent token is wrong or was replaced. Run `npm run agent:token -- --write` in `backend/`, then restart the client |
| MCP tools say they cannot reach the API | Start the backend first (Step 2) |
| Stale or broken demo data | `cd backend && npm run db:reset`, then create a new agent token |