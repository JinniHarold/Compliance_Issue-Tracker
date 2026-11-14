import crypto from "node:crypto";
import path from "node:path";

// Load backend/.env so DB_PATH matches the running API
try { process.loadEnvFile(path.join(__dirname, "../../.env")); } catch { /* use defaults */ }

import("./connection.js").then(({ db }) => {
  const agent = db
    .prepare("SELECT id, email, is_active FROM users WHERE role = 'agent' LIMIT 1")
    .get() as { id: string; email: string; is_active: number } | undefined;
  if (!agent) {
    console.error("No agent account found. Run npm run db:setup first.");
    process.exit(1);
  }
  const token = "agt_" + crypto.randomBytes(32).toString("hex");
  db.prepare("UPDATE users SET api_token_hash = ? WHERE id = ?").run(
    crypto.createHash("sha256").update(token).digest("hex"), agent.id
  );
  if (!agent.is_active) console.error("Warning: the agent account is deactivated, so the token is rejected until an admin reactivates it.");
  console.log(`New agent token for ${agent.email} (shown once; the old token stops working):\n\n${token}\n`);
});