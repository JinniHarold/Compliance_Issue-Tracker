import fs from "node:fs";
import path from "node:path";

// Load backend/.env if it exists (must run before reading process.env below)
try { process.loadEnvFile(path.join(__dirname, "../../.env")); } catch { /* no .env, use defaults */ }

const dbPath = process.env.DB_PATH ?? path.join(__dirname, "../../data/tracker.db");

if (process.argv.includes("--reset")) {
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  console.log("Database reset.");
}

import("./connection.js").then(async ({ db }) => {
  db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  console.log("Schema applied.");
  const { seed } = await import("./seed.js");
  seed(db);
});