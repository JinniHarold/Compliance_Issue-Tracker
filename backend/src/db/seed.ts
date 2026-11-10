import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type BetterSqlite3 from "better-sqlite3";

const DEFAULT_PASSWORD = "Demo@12345"; // demo only, documented in the README
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_PASSWORD;

const newId = () => crypto.randomUUID();
const dayOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const daysAgoISO = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

export function seed(db: BetterSqlite3.Database) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo data in production.");
  }

  const { count } = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (count > 0) {
    console.log("Database already seeded. Run `npm run db:reset` to start fresh.");
    return;
  }

  const adminHash = bcrypt.hashSync(adminPassword, 10);
  const demoHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

  // Agent: own identity, token-only login, no usable password
  const agentToken = "agt_" + crypto.randomBytes(32).toString("hex");
  const agentTokenHash = crypto.createHash("sha256").update(agentToken).digest("hex");
  const unusablePassword = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 10);

  const ids = { admin: newId(), maria: newId(), john: newId(), auditor: newId(), agent: newId() };

  const insertUser = db.prepare(
    `INSERT INTO users (id, email, name, password_hash, role, api_token_hash)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertIssue = db.prepare(
    `INSERT INTO issues (id, title, description, severity, status, owner_id, due_date, created_by, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertEvidence = db.prepare(
    `INSERT INTO evidence (id, issue_id, kind, reference, note, uploaded_by)
     VALUES (?, ?, 'link', ?, ?, ?)`
  );
  const insertAudit = db.prepare(
    `INSERT INTO audit_logs (id, actor_id, actor_type, action, entity_type, entity_id, details)
     VALUES (?, ?, 'human', ?, ?, ?, ?)`
  );

  const issues = [
    { key: "backups", title: "Unencrypted backups on shared drive", severity: "critical", status: "open",
      owner: ids.maria, due: dayOffset(-5), completed: null,
      description: "Nightly backups are stored without encryption on a shared network drive." },
    { key: "access", title: "Quarterly access review not completed", severity: "high", status: "in_progress",
      owner: ids.john, due: dayOffset(-2), completed: null,
      description: "Q3 user access review was not finished for finance systems." },
    { key: "vendor", title: "Vendor contract missing data-processing clause", severity: "high", status: "open",
      owner: ids.maria, due: dayOffset(3), completed: null,
      description: "Contract with a payroll vendor lacks a data-processing agreement." },
    { key: "password", title: "Password policy below required standard", severity: "medium", status: "in_progress",
      owner: ids.john, due: dayOffset(14), completed: null,
      description: "Minimum length is 8 characters; the standard requires 12." },
    { key: "training", title: "Security awareness training overdue", severity: "medium", status: "open",
      owner: ids.maria, due: dayOffset(-10), completed: null,
      description: "Several staff have not completed annual security training." },
    { key: "irplan", title: "Incident response plan out of date", severity: "low", status: "in_review",
      owner: ids.john, due: dayOffset(20), completed: null,
      description: "The plan has not been reviewed in over 18 months." },
    { key: "terminated", title: "Terminated-user accounts not removed", severity: "critical", status: "completed",
      owner: ids.maria, due: dayOffset(-3), completed: daysAgoISO(4),
      description: "Accounts of departed staff remained active after offboarding." },
    { key: "retention", title: "Audit log retention policy missing", severity: "medium", status: "completed",
      owner: ids.john, due: dayOffset(-15), completed: daysAgoISO(16),
      description: "No documented retention period for system audit logs." },
  ];

  // "backups", "training", and "vendor" deliberately have no evidence
  const evidence: Record<string, { url: string; note: string }> = {
    access: { url: "https://example.com/evidence/access-review-draft", note: "Partial review spreadsheet" },
    password: { url: "https://example.com/evidence/password-policy-v2", note: "Draft updated policy" },
    irplan: { url: "https://example.com/evidence/ir-plan-2026", note: "Revised plan awaiting sign-off" },
    terminated: { url: "https://example.com/evidence/offboarding-report", note: "Accounts disabled report" },
    retention: { url: "https://example.com/evidence/retention-policy", note: "Approved policy document" },
  };

  const run = db.transaction(() => {
    insertUser.run(ids.admin, "admin@tracker.local", "Alex Admin", adminHash, "admin", null);
    insertUser.run(ids.maria, "maria@tracker.local", "Maria Santos", demoHash, "owner", null);
    insertUser.run(ids.john, "john@tracker.local", "John Reyes", demoHash, "owner", null);
    insertUser.run(ids.auditor, "auditor@tracker.local", "Ana Auditor", demoHash, "auditor", null);
    insertUser.run(ids.agent, "agent@tracker.local", "Compliance Agent", unusablePassword, "agent", agentTokenHash);

    for (const i of issues) {
      const issueId = newId();
      insertIssue.run(issueId, i.title, i.description, i.severity, i.status, i.owner, i.due, ids.admin, i.completed);
      insertAudit.run(newId(), ids.admin, "issue.created", "issue", issueId, JSON.stringify({ title: i.title }));

      if (i.status === "completed") {
        insertAudit.run(newId(), i.owner, "issue.status_changed", "issue", issueId,
          JSON.stringify({ from: "in_review", to: "completed" }));
      }
      const ev = evidence[i.key];
      if (ev) {
        insertEvidence.run(newId(), issueId, ev.url, ev.note, i.owner);
        insertAudit.run(newId(), i.owner, "evidence.added", "issue", issueId, JSON.stringify({ reference: ev.url }));
      }
    }
  });
  run();

  console.log("\nSeed complete. Demo accounts:");
  console.log("  admin@tracker.local    (admin)   password: " +
    (process.env.SEED_ADMIN_PASSWORD ? "from SEED_ADMIN_PASSWORD in .env" : DEFAULT_PASSWORD));
  console.log("  maria@tracker.local    (owner)   password: " + DEFAULT_PASSWORD);
  console.log("  john@tracker.local     (owner)   password: " + DEFAULT_PASSWORD);
  console.log("  auditor@tracker.local  (auditor) password: " + DEFAULT_PASSWORD);
  console.log("\nAgent API token (shown once, copy it for mcp-server/.env):");
  console.log("  " + agentToken + "\n");
}