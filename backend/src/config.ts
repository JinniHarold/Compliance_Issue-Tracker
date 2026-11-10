import path from "node:path";
import { z } from "zod";

// Load backend/.env if present (no extra package needed on Node 20.12+)
try { process.loadEnvFile(path.join(__dirname, "../.env")); } catch { /* use defaults */ }

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.issues);
  process.exit(1);
}

export const config = parsed.data;