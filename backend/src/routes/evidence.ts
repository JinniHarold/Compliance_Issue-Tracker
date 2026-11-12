import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { addLinkEvidence, listEvidence } from "../services/evidence";

// mergeParams lets this router read :id from the "/issues/:id/evidence" mount path
export const evidenceRouter = Router({ mergeParams: true });
evidenceRouter.use(authenticate);

const idParams = z.object({ id: z.string().uuid() });

// Only plain http(s) links: blocks javascript:, data:, file: and links with embedded passwords
function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && u.username === "" && u.password === "";
  } catch {
    return false;
  }
}

const linkSchema = z
  .object({
    reference: z
      .string()
      .trim()
      .min(1)
      .max(2048)
      .refine(isSafeHttpUrl, "Must be a valid http or https link without embedded credentials")
      .transform((v) => new URL(v).href), // normalized, so duplicates are caught reliably
    note: z.string().trim().max(500).default(""),
  })
  .strict();

evidenceRouter.get("/", requirePermission("issues:read"), (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    res.json({ evidence: listEvidence(id) });
  } catch (err) {
    next(err);
  }
});

evidenceRouter.post("/", requirePermission("evidence:add"), (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const input = linkSchema.parse(req.body ?? {});
    res.status(201).json({ evidence: addLinkEvidence(req.user!, id, input) });
  } catch (err) {
    next(err);
  }
});