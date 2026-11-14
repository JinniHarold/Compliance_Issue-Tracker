import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Load backend/.env so DB_PATH matches the running API
try { process.loadEnvFile(path.join(__dirname, "../../.env")); } catch { /* use defaults */ }

const write = process.argv.includes("--write");

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
  if (!agent.is_active) {
    console.error("Warning: the agent account is deactivated, so the token is rejected until an admin reactivates it.");
  }

  if (!write) {
    console.log(`New agent token for ${agent.email} (shown once; the old token stops working):\n\n${token}\n`);
    return;
  }

  const dir = path.join(__dirname, "../../../mcp-server");
  const envPath = path.join(dir, ".env");
  const examplePath = path.join(dir, ".env.example");
  let text = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : fs.existsSync(examplePath)
      ? fs.readFileSync(examplePath, "utf8")
      : "API_BASE_URL=http://localhost:3000\nAGENT_TOKEN=\n";
  text = /^AGENT_TOKEN=.*$/m.test(text)
    ? text.replace(/^AGENT_TOKEN=.*$/m, `AGENT_TOKEN=${token}`)
    : `${text.trimEnd()}\nAGENT_TOKEN=${token}\n`;
  fs.writeFileSync(envPath, text);
  console.log(`Wrote a new token for ${agent.email} to mcp-server/.env (not printed). The old token no longer works.`);
});