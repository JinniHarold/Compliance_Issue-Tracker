import { beforeAll, describe, expect, it } from "vitest";
import { addAgent, addUser, get, login, post, PASSWORD } from "./helpers";

let ownerId: string;
let agentToken: string;

beforeAll(() => {
  addUser("admin@test.local", "Admin", "admin");
  ownerId = addUser("owner@test.local", "Owner", "owner");
  agentToken = addAgent();
});

describe("authentication", () => {
  it("logs in with correct credentials", async () => {
    const res = await post("/auth/login", undefined, { email: "admin@test.local", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.role).toBe("admin");
    expect(res.body.user).not.toHaveProperty("password_hash");
  });

  it("rejects a wrong password with a generic message", async () => {
    const res = await post("/auth/login", undefined, { email: "admin@test.local", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("gives the same message for an unknown email, so accounts cannot be discovered", async () => {
    const res = await post("/auth/login", undefined, { email: "nobody@test.local", password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("does not let the agent use the login form", async () => {
    const res = await post("/auth/login", undefined, { email: "agent@test.local", password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it("rejects requests with no token", async () => {
    expect((await get("/auth/me")).status).toBe(401);
    expect((await get("/dashboard")).status).toBe(401);
  });

  it("authenticates the agent by its token and reports the agent role", async () => {
    const res = await get("/auth/me", agentToken);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("agent");
    expect((await get("/auth/me", agentToken + "x")).status).toBe(401);
  });

  it("blocks non-admins from user management", async () => {
    const ownerToken = await login("owner@test.local");
    expect((await get("/users", ownerToken)).status).toBe(403);
  });

  it("stops a deactivated user's existing token immediately", async () => {
    const adminToken = await login("admin@test.local");
    const ownerToken = await login("owner@test.local");
    expect((await get("/auth/me", ownerToken)).status).toBe(200);

    expect((await post(`/users/${ownerId}/deactivate`, adminToken)).status).toBe(200);
    expect((await get("/auth/me", ownerToken)).status).toBe(401);

    expect((await post(`/users/${ownerId}/reactivate`, adminToken)).status).toBe(200);
    expect((await get("/auth/me", ownerToken)).status).toBe(200);
  });
});