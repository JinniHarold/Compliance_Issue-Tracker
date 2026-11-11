import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { changeStatus, createIssue, getIssue, listIssues, updateIssue } from "../services/issues";

export const issuesRouter = Router();
issuesRouter.use(authenticate);

const severity = z.enum(["low", "medium", "high", "critical"]);
const status = z.enum(["open", "in_progress", "in_review", "completed"]);

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(s);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Not a real calendar date");
const idParams = z.object({ id: z.string().uuid() });

const listQuery = z.object({
  status: status.optional(),
  severity: severity.optional(),
  owner_id: z.string().uuid().optional(),
  overdue: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(["due_date", "created_at", "updated_at", "severity"]).default("due_date"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).default(""),
  severity,
  owner_id: z.string().uuid(),
  due_date: dateString,
});

const patchSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000),
    severity,
    owner_id: z.string().uuid(),
    due_date: dateString,
  })
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, "Provide at least one field to change");

const statusSchema = z.object({ status });

issuesRouter.get("/", requirePermission("issues:read"), (req, res, next) => {
  try {
    res.json(listIssues(listQuery.parse(req.query)));
  } catch (err) {
    next(err);
  }
});

issuesRouter.get("/:id", requirePermission("issues:read"), (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    res.json({ issue: getIssue(id) });
  } catch (err) {
    next(err);
  }
});

issuesRouter.post("/", requirePermission("issues:create"), (req, res, next) => {
  try {
    const input = createSchema.parse(req.body ?? {});
    res.status(201).json({ issue: createIssue(req.user!, input) });
  } catch (err) {
    next(err);
  }
});

issuesRouter.patch("/:id", requirePermission("issues:update"), (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const patch = patchSchema.parse(req.body ?? {});
    res.json({ issue: updateIssue(req.user!, id, patch) });
  } catch (err) {
    next(err);
  }
});

issuesRouter.post("/:id/status", requirePermission("issues:update"), (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const { status: to } = statusSchema.parse(req.body ?? {});
    res.json({ issue: changeStatus(req.user!, id, to) });
  } catch (err) {
    next(err);
  }
});