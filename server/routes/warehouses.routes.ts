import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (_req, res) => {
  try {
    const { rows } = await query("SELECT * FROM warehouses ORDER BY name");
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/first", async (_req, res) => {
  try {
    const { rows } = await query("SELECT * FROM warehouses ORDER BY created_at ASC LIMIT 1");
    res.json(rows[0] ?? null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, location, canvas_width, canvas_height } = req.body;
    const { rows } = await query(
      `INSERT INTO warehouses (name, location, canvas_width, canvas_height)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, location, canvas_width ?? 800, canvas_height ?? 600],
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name, location, canvas_width, canvas_height } = req.body;
    const { rows } = await query(
      `UPDATE warehouses SET name=$1, location=$2, canvas_width=$3, canvas_height=$4, updated_at=now()
       WHERE id=$5 RETURNING *`,
      [name, location, canvas_width, canvas_height, req.params.id],
    );
    res.json(rows[0] ?? null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await query("DELETE FROM warehouses WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
