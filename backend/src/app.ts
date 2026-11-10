import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config";
import { healthRouter } from "./routes/health";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: "100kb" }));

  app.use("/health", healthRouter);
  // later: /auth, /users, /issues, /evidence, /dashboard, /pending-actions

  app.use(notFoundHandler);
  app.use(errorHandler); // must be last

  return app;
}