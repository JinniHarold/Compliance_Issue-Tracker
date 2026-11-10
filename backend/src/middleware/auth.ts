import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { db } from "../db/connection";
import { unauthorized } from "../utils/errors";
import type { Role } from "./permissions";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface UserRow extends AuthUser {
  is_active: number;
}

const SELECT_USER = "SELECT id, email, name, role, is_active FROM users";

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw unauthorized();
    const token = header.slice(7).trim();

    let user: UserRow | undefined;

    if (token.startsWith("agt_")) {
      // Agent: look up by the SHA-256 hash of the token
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      user = db.prepare(`${SELECT_USER} WHERE api_token_hash = ?`).get(hash) as UserRow | undefined;
      if (user && user.role !== "agent") user = undefined;
    } else {
      // Human: verify the JWT, then load the user fresh from the database
      let sub: string;
      try {
        const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ["HS256"] });
        if (typeof payload === "string" || typeof payload.sub !== "string") throw new Error("bad payload");
        sub = payload.sub;
      } catch {
        throw unauthorized("Invalid or expired token");
      }
      user = db.prepare(`${SELECT_USER} WHERE id = ?`).get(sub) as UserRow | undefined;
      if (user && user.role === "agent") user = undefined; // agents never use JWTs
    }

    if (!user || !user.is_active) throw unauthorized("Invalid or inactive account");

    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}