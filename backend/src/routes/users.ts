import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { changeRole, createUser, listUsers, setActive } from "../services/users";

export const usersRouter = Router();

// Every route below needs a valid login AND the users:manage permission
usersRouter.use(authenticate, requirePermission("users:manage"));

const idParams = z.object({ id: z.string().uuid() });

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(100),
  // "agent" is deliberately not allowed: that account is created by the seed/token script only
  role: z.enum(["admin", "owner", "auditor"]),
  password: z.string().min(12, "Password must be at least 12 characters").max(72),
});

const roleSchema = z.object({ role: z.enum(["admin", "owner", "auditor"]) });

usersRouter.get("/", (_req, res) => {
  res.json({ users: listUsers() });
});

usersRouter.post("/", async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body ?? {});
    const user = await createUser(req.user!, input);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

usersRouter.patch("/:id/role", (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const { role } = roleSchema.parse(req.body ?? {});
    res.json({ user: changeRole(req.user!, id, role) });
  } catch (err) {
    next(err);
  }
});

usersRouter.post("/:id/deactivate", (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    res.json({ user: setActive(req.user!, id, false) });
  } catch (err) {
    next(err);
  }
});

usersRouter.post("/:id/reactivate", (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    res.json({ user: setActive(req.user!, id, true) });
  } catch (err) {
    next(err);
  }
});