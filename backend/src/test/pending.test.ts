import { beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/connection";
import { addAgent, addUser, get, login, newIssue, post } from "./helpers";

let admin: string, maria: string, agent: string;
let mariaId: string;
let issueId: string;
let proposalId: string;

beforeAll(async () => {
  addUser("admin@test.local", "Admin", "admin");
  mariaId = addUser("maria@test.local", "Maria", "owner");
  agent = addAgent();
  admin = await login("admin@test.local");
  maria = await login("maria@test.local");
  issueId = await newIssue(admin, mariaId);
});

const proposal = (id: string) => ({
  issue_id: id,
  action_type: "update_severity",
  severity: "high",
  rationale: "Overdue and untouched for two weeks.",
});

// These tests run in order and share the same proposal
describe("agent proposals and the approval gate", () => {
  it("saves an agent proposal as pending without changing the issue", async () => {
    const res = await post("/pending-actions", agent, proposal(issueId));
    expect(res.status).toBe(201);
    expect(res.body.pending_action.status).toBe("pending");
    proposalId = res.body.pending_action.id;

    expect((await get(`/issues/${issueId}`, admin)).body.issue.severity).toBe("medium");
  });

  it("blocks a second pending proposal of the same type", async () => {
    expect((await post("/pending-actions", agent, proposal(issueId))).status).toBe(409);
  });

  it("does not let the agent or an owner decide a proposal", async () => {
    expect((await post(`/pending-actions/${proposalId}/approve`, agent)).status).toBe(403);
    expect((await post(`/pending-actions/${proposalId}/reject`, agent, { note: "no" })).status).toBe(403);
    expect((await post(`/pending-actions/${proposalId}/approve`, maria)).status).toBe(403);
  });

  it("does not let owners propose", async () => {
    expect((await post("/pending-actions", maria, proposal(issueId))).status).toBe(403);
  });

  it("applies the change only when an admin approves", async () => {
    const res = await post(`/pending-actions/${proposalId}/approve`, admin, { note: "Agreed" });
    expect(res.status).toBe(200);
    expect(res.body.pending_action.status).toBe("approved");
    expect(res.body.pending_action.decided_by_name).toBe("Admin");
    expect(res.body.issue.severity).toBe("high");
  });

  it("records the agent as proposer and the human as decider in the audit log", async () => {
    const res = await get(`/audit?entity_type=issue&entity_id=${issueId}`, admin);
    const trail = res.body.entries.map((e: { actor_type: string; action: string }) => `${e.actor_type}:${e.action}`);
    expect(trail).toContain("agent:pending_action.proposed");
    expect(trail).toContain("human:pending_action.approved");
  });

  it("refuses to approve the same proposal twice", async () => {
    expect((await post(`/pending-actions/${proposalId}/approve`, admin)).status).toBe(409);
  });

  it("fails safely when the issue changed after the proposal was made", async () => {
    const other = await newIssue(admin, mariaId, { title: "Stale case" });
    const made = await post("/pending-actions", agent, {
      issue_id: other, action_type: "start", rationale: "Work should begin on this issue.",
    });
    expect(made.status).toBe(201);
    const id = made.body.pending_action.id;

    expect((await post(`/issues/${other}/start`, admin)).status).toBe(200); // human acts first
    expect((await post(`/pending-actions/${id}/approve`, admin)).status).toBe(409);
    expect((await get(`/pending-actions/${id}`, admin)).body.pending_action.status).toBe("pending");

    expect((await post(`/pending-actions/${id}/reject`, admin)).status).toBe(400); // reason required
    const rejected = await post(`/pending-actions/${id}/reject`, admin, { note: "Superseded" });
    expect(rejected.body.pending_action.status).toBe("rejected");
  });

  it("enforces approver != requester in the database itself", () => {
    expect(() =>
      db.prepare("UPDATE pending_actions SET decided_by = requested_by WHERE id = ?").run(proposalId)
    ).toThrow(/CHECK/i);
  });

  it("keeps the audit log append-only in the database", () => {
    expect(() => db.prepare("DELETE FROM audit_logs").run()).toThrow(/append-only/);
    expect(() => db.prepare("UPDATE audit_logs SET action = 'x'").run()).toThrow(/append-only/);
  });
});