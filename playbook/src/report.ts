import type { RunReport } from "./run.js";

// Titles are user-written: strip control characters and keep them short before printing
const clean = (s: string, max = 80) => s.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);

export function formatReport(r: RunReport): string {
  const out: string[] = [];
  out.push(`Playbook run (${r.mode}): ${r.totals.checked} active issue(s) checked`);
  out.push(
    r.mode === "dry-run"
      ? "DRY RUN: nothing was changed. Add --apply to perform the planned actions."
      : "APPLY: safe notes are posted; changes to issues are only proposed and wait for admin approval."
  );
  out.push("");
  for (const i of r.issues) {
    out.push(`${clean(i.title)}  [${i.severity}, ${i.status}]`);
    if (i.error) out.push(`  ERROR: ${clean(i.error, 200)}`);
    else if (i.findings.length === 0) out.push("  No findings. No action needed.");
    else {
      out.push(`  Findings: ${i.findings.join("; ")}`);
      for (const a of i.actions) {
        const tag = { planned: "PLAN", done: "DONE", skipped: "SKIP", failed: "FAIL" }[a.status];
        out.push(`  ${tag}  ${a.kind}: ${clean(a.summary, 140)}${a.note ? `  (${clean(a.note, 160)})` : ""}`);
      }
    }
    out.push("");
  }
  const t = r.totals;
  out.push(
    `Summary: ${t.withFindings} with findings | done ${t.done} | planned ${t.planned} | skipped ${t.skipped} | failed ${t.failed}`
  );
  return out.join("\n");
}
