import { Router } from "express";
import { z } from "zod";

import { requireAdmin } from "../middleware/adminAuth";
import { registerAdminAlertToken, sendAdminAlert } from "../lib/adminAlert";

const router = Router();
router.use(requireAdmin);

// POST /api/admin/alerts/register — adds this device's FCM token to the
// admin-alert list (see lib/adminAlert.ts). Called from the /admin page's
// "Turn on admin alerts" button.
router.post("/register", async (req, res) => {
  const parsed = z.object({ fcmToken: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const count = await registerAdminAlertToken(parsed.data.fcmToken);
  res.json({ ok: true, devices: count });
});

// POST /api/admin/alerts/test — sends a test alert to every registered
// admin device, so setup can be confirmed end to end.
router.post("/test", async (_req, res) => {
  const result = await sendAdminAlert("Full Set admin alerts are on", "You'll get a push here if team lists stop updating.");
  res.json(result);
});

export default router;
