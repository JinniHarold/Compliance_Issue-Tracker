import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { db } from "../db/connection";
import { createApp } from "../app";

// Each test file gets its own in-memory database; build the real schema in it
db.exec(fs.readFileSync(path.join(process.cwd(), "src/db/schema.sql"), "utf8"));

export const app = createApp();
export const PASSWORD = "Test-Passw0rd-123";

export function addUser(email: string, name: string, role: "admin" | "owner" | "auditor"): string {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)").run(
    id, email, name, bcrypt.hashSync(PASSWORD, 4), role // low cost keeps tests fast
  );
  return id;
}

// Returns the raw agent token, like the seed script does (only its hash is stored)
export function addAgent(): string {
  const token = "agt_" + crypto.randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, role, api_token_hash) VALUES (?, ?, ?, ?, 'agent', ?)"
  ).run(
    crypto.randomUUID(), "agent@test.local", "Agent",
    bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), 4),
    crypto.createHash("sha256").update(token).digest("hex")
  );
  return token;
}

function withAuth(t: request.Test, token?: string) {
  return token ? t.set("Authorization", `Bearer ${token}`) : t;
}
export const get = (p: string, token?: string) => withAuth(request(app).get(p), token);
export const post = (p: string, token?: string, body: object = {}) =>
  withAuth(request(app).post(p), token).send(body);
export const patch = (p: string, token?: string, body: object = {}) =>
  withAuth(request(app).patch(p), token).send(body);

export async function login(email: string): Promise<string> {
  const res = await post("/auth/login", undefined, { email, password: PASSWORD });
  return res.body.token as string;
}

export async function newIssue(adminToken: string, ownerId: string, over: object = {}): Promise<string> {
  const res = await post("/issues", adminToken, {
    title: "Test issue", description: "Test description", severity: "medium",
    owner_id: ownerId, due_date: "2030-01-01", ...over,
  });
  return res.body.issue.id as string;
}