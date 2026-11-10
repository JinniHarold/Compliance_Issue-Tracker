import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config";
import { db } from "../db/connection";
import { authenticate, type AuthUser } from "../middleware/auth";
import { recordAudit } from "../services/audit";
import { unauthorized } from "../utils/errors";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

// Used when the email doesn't exist, so response time doesn't reveal which emails are real
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Only failed attempts count toward the limit
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many failed login attempts. Try again later." } },
});

interface LoginRow extends AuthUser {
  password_hash: string;
  is_active: number;
}

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = db
      .prepare("SELECT id, email, name, role, is_active, password_hash FROM users WHERE email = ?")
      .get(email) as LoginRow | undefined;

    const passwordOk = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

    // One generic message for every failure reason
    if (!user || !passwordOk || !user.is_active || user.role === "agent") {
      throw unauthorized("Invalid email or password");
    }

    const authUser: AuthUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = jwt.sign({ sub: user.id, role: user.role }, config.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: config.JWT_EXPIRES_SECONDS,
    });

    recordAudit(authUser, "auth.login", "user", user.id);
    res.json({ token, user: authUser });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});