import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getDashboard } from "../services/dashboard";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate, requirePermission("dashboard:read"));

dashboardRouter.get("/", (_req, res, next) => {
  try {
    res.json(getDashboard());
  } catch (err) {
    next(err);
  }
});