import path from "node:path";
import { z } from "zod";

// Load backend/.env if present (no extra package needed on Node 20.12+)
try { process.loadEnvFile(path.join(__dirname, "../.env")); } catch { /* use defaults */ }

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_SECONDS: z.coerce.number().int().positive().default(3600),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.issues);
  process.exit(1);
}
if (parsed.data.NODE_ENV === "production" && parsed.data.JWT_SECRET.includes("change-me")) {
  console.error("Refusing to start in production with the placeholder JWT_SECRET.");
  process.exit(1);
}

export const config = parsed.data;