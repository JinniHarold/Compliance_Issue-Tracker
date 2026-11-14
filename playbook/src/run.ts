import { analyze, buildComment } from "./analyze.js";
import type { Issue, Proposal } from "./types.js";

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

/** The playbook only talks to the world through this interface (the MCP tools). */
export interface Tools {
  call(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}

export interface Options {
  apply: boolean;
  maxActions: number;
  issueId?: string;
  now?: Date;
}

export interface ActionOutcome {
  kind: "comment" | "proposal";
  summary: string;
  status: "planned" | "done" | "skipped" | "failed";
  note?: string;
}

export interface IssueReport {
  issue_id: string;
  title: string;
  status: string;
  severity: string;
  findings: string[];
  actions: ActionOutcome[];
  error?: string;
}

export interface RunReport {
  mode: "dry-run" | "apply";
  issues: IssueReport[];
  totals: {
    checked: number;
    withFindings: number;
    done: number;
    planned: number;
    skipped: number;
    failed: number;
  };
}

function pick<T>(data: unknown, key: string): T[] {
  const value = (data as Record<string, unknown> | null | undefined)?.[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

async function loadIssues(tools: Tools, issueId?: string): Promise<Issue[]> {
  if (issueId) {
    const r = await tools.call("get_issue", { issue_id: issueId });
    if (!r.ok) throw new Error(`get_issue failed: ${r.error}`);
    const issue = (r.data as { issue?: Issue }).issue;
    if (!issue) throw new Error("get_issue returned no issue");
    return [issue];
  }
  const all: Issue[] = [];
  for (const status of ["open", "in_progress", "in_review"]) {
    const r = await tools.call("list_issues", { status, limit: 50 });
    if (!r.ok) throw new Error(`list_issues (${status}) failed: ${r.error}`);
    all.push(...pick<Issue>(r.data, "issues"));
  }
  return all;
}

export async function runPlaybook(tools: Tools, opts: Options): Promise<RunReport> {
  const now = opts.now ?? new Date();
  const issues = await loadIssues(tools, opts.issueId);
  const reports: IssueReport[] = [];
  let writes = 0; // planned or performed writes, checked against the per-run cap

  for (const issue of issues) {
    const analysis = analyze(issue, now);
    const report: IssueReport = {
      issue_id: issue.id,
      title: issue.title,
      status: issue.status,
      severity: issue.severity,
      findings: analysis.findings.map((f) => f.detail),
      actions: [],
    };
    reports.push(report);
    if (analysis.findings.length === 0) continue;

    const [commentsRes, pendingRes] = await Promise.all([
      tools.call("list_comments", { issue_id: issue.id }),
      tools.call("list_proposals", { issue_id: issue.id, status: "pending" }),
    ]);
    if (!commentsRes.ok || !pendingRes.ok) {
      report.error = `Could not read history: ${commentsRes.error ?? pendingRes.error}`;
      continue;
    }
    const comments = pick<{ body?: string; author_role?: string }>(commentsRes.data, "comments");
    const pending = pick<{ action_type?: string }>(pendingRes.data, "pending_actions");

    // Runs one write, honouring dry-run and the action cap
    const act = async (
      kind: ActionOutcome["kind"],
      summary: string,
      skipReason: string | null,
      call: () => Promise<ToolResult>
    ) => {
      if (skipReason) return report.actions.push({ kind, summary, status: "skipped", note: skipReason });
      if (writes >= opts.maxActions) {
        return report.actions.push({ kind, summary, status: "skipped", note: "action cap reached for this run" });
      }
      writes++;
      if (!opts.apply) return report.actions.push({ kind, summary, status: "planned" });
      const r = await call();
      report.actions.push(
        r.ok ? { kind, summary, status: "done" } : { kind, summary, status: "failed", note: r.error }
      );
    };

    // Proposals first (they need a human), then the explanatory note
    for (const p of analysis.proposals) {
      const dup = pending.some((x) => x.action_type === p.action_type);
      await act(
        "proposal",
        `${p.action_type}${p.severity ? ` to ${p.severity}` : ""}: ${p.rationale}`,
        dup ? "a pending proposal of this type already exists" : null,
        () => tools.call("propose_action", proposalArgs(issue.id, p))
      );
    }

    const marker = `ref:${analysis.fingerprint}`;
    const alreadyPosted = comments.some(
      (c) => c.author_role === "agent" && typeof c.body === "string" && c.body.includes(marker)
    );
    await act(
      "comment",
      "Add analysis note with recommended next steps",
      alreadyPosted ? "this analysis was already posted for the issue's current state" : null,
      () => tools.call("add_comment", { issue_id: issue.id, body: buildComment(analysis) })
    );
  }

  const actions = reports.flatMap((r) => r.actions);
  const count = (s: ActionOutcome["status"]) => actions.filter((a) => a.status === s).length;
  return {
    mode: opts.apply ? "apply" : "dry-run",
    issues: reports,
    totals: {
      checked: reports.length,
      withFindings: reports.filter((r) => r.findings.length > 0).length,
      done: count("done"),
      planned: count("planned"),
      skipped: count("skipped"),
      failed: count("failed") + reports.filter((r) => r.error).length,
    },
  };
}

function proposalArgs(issueId: string, p: Proposal): Record<string, unknown> {
  return {
    issue_id: issueId,
    action_type: p.action_type,
    rationale: p.rationale,
    ...(p.comment ? { comment: p.comment } : {}),
    ...(p.severity ? { severity: p.severity } : {}),
  };
}
