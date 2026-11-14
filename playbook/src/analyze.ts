import crypto from "node:crypto";
import type { Analysis, Finding, Issue, Proposal, Severity } from "./types.js";

const DAY = 86_400_000;
const NEXT: Record<Severity, Severity | null> = { low: "medium", medium: "high", high: "critical", critical: null };

// Days of overdue before the playbook suggests a higher severity
const ESCALATE_AFTER: Record<Severity, number> = { low: 7, medium: 7, high: 14, critical: Infinity };
const STALLED_AFTER_DAYS = 7;
const DUE_SOON_DAYS = 3;

const utcDate = (d: Date) => d.toISOString().slice(0, 10);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Whole days between a YYYY-MM-DD date and today (positive = date is in the past). */
export function daysPast(date: string, now: Date): number {
  return Math.floor((Date.parse(utcDate(now)) - Date.parse(date)) / DAY);
}

function idleDays(updatedAt: string, now: Date): number {
  const iso = updatedAt.includes("T") ? updatedAt : `${updatedAt.replace(" ", "T")}Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : Math.floor((now.getTime() - t) / DAY);
}

/** Pure, deterministic rules: the same issue and date always give the same analysis. */
export function analyze(issue: Issue, now: Date): Analysis {
  const findings: Finding[] = [];
  const steps: string[] = [];
  const proposals: Proposal[] = [];

  if (issue.status !== "completed") {
    const overdue = Math.max(0, daysPast(issue.due_date, now));
    const untilDue = -daysPast(issue.due_date, now);

    if (overdue > 0) {
      findings.push({ code: "OVERDUE", detail: `Overdue by ${plural(overdue, "day")}` });
      steps.push(`Confirm a new target date with the owner or escalate; it is ${plural(overdue, "day")} past due.`);
    } else if (untilDue >= 0 && untilDue <= DUE_SOON_DAYS) {
      findings.push({ code: "DUE_SOON", detail: `Due in ${plural(untilDue, "day")}` });
      steps.push(`Due in ${plural(untilDue, "day")}; confirm the owner is on track.`);
    }

    if (issue.status === "open" && overdue > 0) {
      findings.push({ code: "NOT_STARTED", detail: "Overdue and not started" });
      steps.push("Confirm the owner and start work on this issue.");
    }

    if (issue.status === "in_progress") {
      const idle = idleDays(issue.updated_at, now);
      if (idle >= STALLED_AFTER_DAYS) {
        findings.push({ code: "STALLED", detail: `No updates for ${plural(idle, "day")}` });
        steps.push(`No updates for ${plural(idle, "day")}; ask the owner for a status update.`);
      }
      if (issue.evidence_count === 0) {
        findings.push({ code: "NO_EVIDENCE", detail: "No evidence attached" });
        steps.push("Ask the owner to attach evidence, such as a link to proof of the fix.");
      }
    }

    if (issue.status === "in_review") {
      if (issue.evidence_count === 0) {
        findings.push({ code: "IN_REVIEW_NO_EVIDENCE", detail: "In review with no evidence attached" });
        steps.push("Do not complete yet: no evidence is attached. Send it back so the owner can add proof.");
        proposals.push({
          action_type: "request_revision",
          comment: "Evidence is required before this issue can be completed. Please attach proof and resubmit.",
          rationale: "In review with no evidence attached, so completion would be refused. Sending back for evidence.",
        });
      } else {
        findings.push({ code: "IN_REVIEW_READY", detail: `In review with ${plural(issue.evidence_count, "evidence item")}` });
        steps.push("Evidence is attached; an admin can review it and complete the issue.");
        proposals.push({
          action_type: "complete",
          rationale: `In review with ${plural(issue.evidence_count, "evidence item")} attached; ready for admin sign-off.`,
        });
      }
    }

    const next = NEXT[issue.severity];
    if (next && overdue >= ESCALATE_AFTER[issue.severity]) {
      findings.push({ code: "SEVERITY_LOW_FOR_AGE", detail: `Severity ${issue.severity} looks low for ${plural(overdue, "day")} overdue` });
      steps.push(`Consider raising severity from ${issue.severity} to ${next}.`);
      proposals.push({
        action_type: "update_severity",
        severity: next,
        rationale: `Overdue ${plural(overdue, "day")} at ${issue.severity} severity; recommend raising to ${next}.`,
      });
    }
  }

  const fingerprint = crypto
    .createHash("sha256")
    .update([issue.id, issue.status, issue.severity, ...findings.map((f) => f.code).sort()].join("|"))
    .digest("hex")
    .slice(0, 8);

  return { findings, steps, proposals, fingerprint };
}

/** The note posted on the issue. The ref marker lets later runs skip a note they already posted. */
export function buildComment(a: Analysis): string {
  const lines = [
    `[Playbook analysis ref:${a.fingerprint}]`,
    `Findings: ${a.findings.map((f) => f.detail).join("; ")}.`,
    "Recommended next steps:",
    ...a.steps.map((s, i) => `${i + 1}. ${s}`),
    a.proposals.length
      ? "Proposed changes, if created, are waiting for admin approval on the Approvals screen."
      : "No change proposals were needed.",
    "(Automated, rule-based note.)",
  ];
  return lines.join("\n").slice(0, 1900);
}
