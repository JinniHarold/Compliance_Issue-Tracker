import { Router } from "express";
import { db } from "../db/connection";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  db.prepare("SELECT 1").get(); // throws if the database is unreachable
  res.json({ status: "ok", time: new Date().toISOString() });
});