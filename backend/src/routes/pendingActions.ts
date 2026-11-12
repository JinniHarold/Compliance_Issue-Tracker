import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getIssue } from "../services/issues";
import {
  approvePending,
  getPending,
  listPending,
  proposeAction,
  rejectPending,
} from "../services/pendingActions";

export const pendingActionsRouter = Router();
pendingActionsRouter.use(authenticate);

const idParams = z.object({ id: z.string().uuid() });
const severity = z.enum(["low", "medium", "high", "critical"]);

const listQuery = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  issue_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const proposeSchema = z
  .object({
    issue_id: z.string().uuid(),
    action_type: z.enum(["start", "request_review", "request_revision", "complete", "reopen", "update_severity"]),
    rationale: z.string().trim().min(10, "Explain why in at least 10 characters").max(1000),
    comment: z.string().trim().min(1).max(2000).optional(),
    severity: severity.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.action_type === "update_severity" && !v.severity) {
      ctx.addIssue({ code: "custom", path: ["severity"], message: "Required for update_severity" });
    }
    if (v.action_type !== "update_severity" && v.severity) {
      ctx.addIssue({ code: "custom", path: ["severity"], message: "Only allowed for update_severity" });
    }
    if ((v.action_type === "request_revision" || v.action_type === "reopen") && !v.comment) {
      ctx.addIssue({ code: "custom", path: ["comment"], message: "A comment is required for this action" });
    }
  });

const approveSchema = z.object({ note: z.string().trim().max(500).optional() }).strict();
const rejectSchema = z.object({ note: z.string().trim().min(1, "A reason is required").max(500) }).strict();

pendingActionsRouter.get("/", requirePermission("issues:read"), (req, res, next) => {
  try {
    res.json(listPending(listQuery.parse(req.query)));
  } catch (err) {
    next(err);
  }
});

pendingActionsRouter.get("/:id", requirePermission("issues:read"), (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    res.json({ pending_action: getPending(id) });
  } catch (err) {
    next(err);
  }
});

pendingActionsRouter.post("/", requirePermission("pending:propose"), (req, res, next) => {
  try {
    const input = proposeSchema.parse(req.body ?? {});
    res.status(201).json({ pending_action: proposeAction(req.user!, input) });
  } catch (err) {
    next(err);
  }
});

pendingActionsRouter.post("/:id/approve", requirePermission("pending:decide"), (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const { note } = approveSchema.parse(req.body ?? {});
    const pending_action = approvePending(req.user!, id, note);
    res.json({ pending_action, issue: getIssue(pending_action.issue_id) });
  } catch (err) {
    next(err);
  }
});

pendingActionsRouter.post("/:id/reject", requirePermission("pending:decide"), (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const { note } = rejectSchema.parse(req.body ?? {});
    res.json({ pending_action: rejectPending(req.user!, id, note) });
  } catch (err) {
    next(err);
  }
});