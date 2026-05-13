import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = Router();

// GET /api/landing — public, no auth
router.get("/", async (_req, res) => {
  try {
    const { rows } = await query("SELECT key, value FROM landing_content");
    const content: Record<string, string> = {};
    for (const row of rows) {
      content[row.key] = row.value;
    }
    res.json(content);
  } catch (err: any) {
    console.error("[landing]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/landing — auth required
router.put("/", authMiddleware, async (req, res) => {
  try {
    const entries = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(entries)) {
      await query(
        `INSERT INTO landing_content (key, value, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
        [key, value],
      );
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[landing]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
