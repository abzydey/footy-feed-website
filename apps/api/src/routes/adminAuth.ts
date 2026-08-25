import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { prisma } from "../lib/prisma";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/admin/auth/login — the only public admin-panel endpoint.
// Admin accounts are created via the db:seed script, not self-service signup.
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Server misconfigured: ADMIN_JWT_SECRET missing" });
  }

  const token = jwt.sign({ id: admin.id, email: admin.email }, secret, { expiresIn: "7d" });
  res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
});

export default router;
