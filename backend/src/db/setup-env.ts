import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.join(__dirname, "../..");
const example = path.join(root, ".env.example");
const target = path.join(root, ".env");

if (fs.existsSync(target)) {
  console.log(".env already exists, so it was left unchanged.");
  process.exit(0);
}

const secret = crypto.randomBytes(48).toString("hex");
const text = fs.readFileSync(example, "utf8").replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
fs.writeFileSync(target, text);
console.log("Created backend/.env with a new JWT_SECRET.");