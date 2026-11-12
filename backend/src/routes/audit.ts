import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { listAudit } from "../services/audit";
import { dateString } from "../utils/validation";

export const auditRouter = Router();
auditRouter.use(authenticate, requirePermission("audit:read"));

const query = z.object({
  entity_type: z.enum(["issue", "user"]).optional(),
  entity_id: z.string().uuid().optional(),
  actor_id: z.string().uuid().optional(),
  actor_type: z.enum(["human", "agent"]).optional(),
  action: z.string().trim().min(1).max(60).regex(/^[a-z_.]+$/, "Letters, dots and underscores only").optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

auditRouter.get("/", (req, res, next) => {
  try {
    res.json(listAudit(query.parse(req.query)));
  } catch (err) {
    next(err);
  }
});