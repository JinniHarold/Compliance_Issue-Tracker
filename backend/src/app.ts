import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config";
import { healthRouter } from "./routes/health";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { issuesRouter } from "./routes/issues";
import { evidenceRouter } from "./routes/evidence";
import { auditRouter } from "./routes/audit";
import { dashboardRouter } from "./routes/dashboard";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: "100kb" }));

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/issues", issuesRouter);
  app.use("/issues/:id/evidence", evidenceRouter);
  app.use("/audit", auditRouter);
  app.use("/dashboard", dashboardRouter);
  
  app.use(notFoundHandler);
  app.use(errorHandler); // must be last

  return app;
}