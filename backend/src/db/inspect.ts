import path from "node:path";
import Database from "better-sqlite3";

const dbPath = process.env.DB_PATH ?? path.join(__dirname, "../../data/tracker.db");
const db = new Database(dbPath, { readonly: true });

const counts = ["users", "issues", "evidence", "audit_logs", "pending_actions"].map((t) => ({
  table: t,
  rows: (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n,
}));
console.log("\nRow counts");
console.table(counts);

console.log("Users (secrets hidden)");
console.table(db.prepare("SELECT email, role, is_active FROM users").all());

console.log("Issues");
console.table(
  db.prepare("SELECT title, severity, status, due_date FROM issues ORDER BY due_date").all()
);

db.close();