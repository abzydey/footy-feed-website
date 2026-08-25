import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AdminAuthedRequest extends Request {
  admin?: { id: string; email: string };
}

/**
 * Guards the admin panel API routes. Expects `Authorization: Bearer <jwt>`
 * from an /api/admin/login call. Deliberately simple for v1 — a handful of
 * trusted internal users, not a general-purpose auth system.
 */
export function requireAdmin(req: AdminAuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    return res.status(401).json({ error: "Missing admin token" });
  }

  try {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) throw new Error("ADMIN_JWT_SECRET not configured");
    const payload = jwt.verify(token, secret) as { id: string; email: string };
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired admin token" });
  }
}
