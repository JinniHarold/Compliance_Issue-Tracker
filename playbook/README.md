# Playbook

A rule-based script that analyzes active issues and acts through the **MCP server's tools**. It needs no AI model and no API key.

```
playbook  ->  MCP client  ->  mcp-server (agent token)  ->  API  ->  database
```

The playbook never sees the agent token (the MCP server reads it from `mcp-server/.env`) and has no tool to approve, edit, or add evidence.

## Run it
Prerequisites: backend running, `mcp-server` set up (`npm install`, `.env` with the agent token), then in this folder:

```
npm install
npm run dry-run            # shows the plan, changes nothing
npm run apply              # posts notes and creates proposals
npm run dry-run -- --issue <issue-uuid>
npm run apply -- --max-actions 5
```

## What it does for each open, in-progress, or in-review issue
| Finding | Rule | Output |
|---|---|---|
| Overdue | past the due date | note |
| Not started | overdue and still open | note |
| Stalled | in progress, no update for 7+ days | note |
| No evidence | in progress with no evidence | note |
| Due soon | due within 3 days | note |
| Severity low for age | overdue 7+ days (low, medium) or 14+ days (high) | **proposal**: raise one level |
| In review, no evidence | cannot be completed | **proposal**: send back, with a comment |
| In review, evidence attached | ready for sign-off | **proposal**: complete |

- A **note** is an agent comment with ordered next steps. It is low risk and posted automatically with `--apply`.
- A **proposal** changes the record, so it only goes to the Approvals screen. An admin approves or rejects it.

## Safeguards
- **Dry run by default.** Nothing is written without `--apply`.
- **Idempotent.** A note carries a `ref:` marker and is not posted twice for the same state. A proposal is skipped if one of that type is already pending.
- **Action cap** per run (`--max-actions`, default 10).
- **Decisions use structured fields only** (status, severity, dates, counts). Issue titles, descriptions, and comments are never interpreted, so text written to trick an AI has no effect.
- **Everything is attributable.** Notes and proposals are recorded in the audit log as `agent` actions, and the console report shows what was planned, done, skipped, or failed.

## Tests
```
npm test
```
Covers the rules, the dry-run and apply modes, idempotency, the cap, failure handling, and resistance to hostile text.
