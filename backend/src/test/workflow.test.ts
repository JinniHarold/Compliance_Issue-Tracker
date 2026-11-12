import { beforeAll, describe, expect, it } from "vitest";
import { addAgent, addUser, get, login, newIssue, patch, post } from "./helpers";

let admin: string, maria: string, john: string, auditor: string, agent: string;
let mariaId: string;
let issueId: string;

const evidence = { reference: "https://example.com/proof.png", note: "Screenshot" };

beforeAll(async () => {
  addUser("admin@test.local", "Admin", "admin");
  mariaId = addUser("maria@test.local", "Maria", "owner");
  addUser("john@test.local", "John", "owner");
  addUser("auditor@test.local", "Auditor", "auditor");
  agent = addAgent();
  admin = await login("admin@test.local");
  maria = await login("maria@test.local");
  john = await login("john@test.local");
  auditor = await login("auditor@test.local");
  issueId = await newIssue(admin, mariaId);
});

// These tests share one issue and run in order, like the real review workflow
describe("issue review workflow", () => {
  it("lets only admins create issues", async () => {
    const body = { title: "Another issue", severity: "low", owner_id: mariaId, due_date: "2030-01-01" };
    expect((await post("/issues", maria, body)).status).toBe(403);
    expect((await post("/issues", auditor, body)).status).toBe(403);
    expect((await post("/issues", admin, body)).status).toBe(201);
  });

  it("lets the owner start and submit their own issue, but not another owner", async () => {
    expect((await post(`/issues/${issueId}/start`, john)).status).toBe(403);
    expect((await post(`/issues/${issueId}/start`, maria)).body.issue.status).toBe("in_progress");
    expect((await post(`/issues/${issueId}/request-review`, maria)).body.issue.status).toBe("in_review");
  });

  it("locks the owner out while the issue is in review", async () => {
    expect((await patch(`/issues/${issueId}`, maria, { description: "sneaky edit" })).status).toBe(409);
    expect((await post(`/issues/${issueId}/evidence`, maria, evidence)).status).toBe(409);
  });

  it("does not let the owner complete or send back their own work", async () => {
    expect((await post(`/issues/${issueId}/complete`, maria)).status).toBe(403);
    expect((await post(`/issues/${issueId}/request-revision`, maria, { comment: "approve me" })).status).toBe(403);
  });

  it("requires a comment to send work back, then returns edit rights to the owner", async () => {
    expect((await post(`/issues/${issueId}/request-revision`, admin)).status).toBe(400);
    const back = await post(`/issues/${issueId}/request-revision`, admin, { comment: "Please attach proof" });
    expect(back.body.issue.status).toBe("in_progress");
    expect((await patch(`/issues/${issueId}`, maria, { description: "Updated by owner" })).status).toBe(200);

    const comments = await get(`/issues/${issueId}/comments`, maria);
    expect(comments.body.comments.some((c: { kind: string }) => c.kind === "revision_requested")).toBe(true);
  });

  it("requires evidence before an issue can be completed", async () => {
    expect((await post(`/issues/${issueId}/request-review`, maria)).status).toBe(200);
    const noEvidence = await post(`/issues/${issueId}/complete`, admin);
    expect(noEvidence.status).toBe(409);

    await post(`/issues/${issueId}/request-revision`, admin, { comment: "Attach the proof first" });
    expect((await post(`/issues/${issueId}/evidence`, maria, evidence)).status).toBe(201);
    await post(`/issues/${issueId}/request-review`, maria);

    const done = await post(`/issues/${issueId}/complete`, admin);
    expect(done.status).toBe(200);
    expect(done.body.issue.status).toBe("completed");
    expect(done.body.issue.completed_at).toBeTruthy();
    expect((await patch(`/issues/${issueId}`, maria, { description: "late edit" })).status).toBe(409);
  });

  it("accepts only safe evidence links and keeps the agent from adding evidence", async () => {
    const open = await newIssue(admin, mariaId, { title: "Second issue" });
    expect((await post(`/issues/${open}/evidence`, maria, { reference: "javascript:alert(1)" })).status).toBe(400);
    expect((await post(`/issues/${open}/evidence`, maria, { reference: "https://user:pw@example.com/x" })).status).toBe(400);
    expect((await post(`/issues/${open}/evidence`, maria, { ...evidence, kind: "file" })).status).toBe(400);
    expect((await post(`/issues/${open}/evidence`, agent, evidence)).status).toBe(403);
    expect((await post(`/issues/${open}/evidence`, maria, evidence)).status).toBe(201);
    expect((await post(`/issues/${open}/evidence`, maria, evidence)).status).toBe(409); // duplicate
  });

  it("refuses status moves that skip the workflow", async () => {
    const open = await newIssue(admin, mariaId, { title: "Third issue" });
    const res = await post(`/issues/${open}/complete`, admin);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/in_review/);
  });
});