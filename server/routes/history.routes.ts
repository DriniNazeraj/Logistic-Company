import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || "").trim().toLowerCase();
    const result = req.query.result as string || "";

    const conditions: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (search) {
      conditions.push(`(LOWER(client_name) LIKE $${i} OR LOWER(client_id_number) LIKE $${i} OR LOWER(package_code) LIKE $${i})`);
      vals.push(`%${search}%`);
      i++;
    }

    if (result === "success" || result === "mismatch") {
      conditions.push(`result = $${i}`);
      vals.push(result);
      i++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [{ rows }, { rows: countRows }] = await Promise.all([
      query(
        `SELECT * FROM scan_logs ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
        [...vals, limit, offset],
      ),
      query(`SELECT COUNT(*)::int AS total FROM scan_logs ${where}`, vals),
    ]);

    res.json({ data: rows, total: countRows[0].total, page, limit });
  } catch (err: any) {
    console.error("[history]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
