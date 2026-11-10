import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.DB_PATH ?? path.join(__dirname, "../../data/tracker.db");

if (process.argv.includes("--reset")) {
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  console.log("Database reset.");
}

import("./connection.js").then(({ db }) => {
  db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  console.log("Schema applied.");
  // seed runs here later
});