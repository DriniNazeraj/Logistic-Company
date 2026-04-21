import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const wid = req.query.warehouse_id as string | undefined;
    if (wid) {
      const { rows } = await query(
        "SELECT * FROM sections WHERE warehouse_id = $1 ORDER BY created_at ASC",
        [wid],
      );
      res.json(rows);
    } else {
      const { rows } = await query("SELECT * FROM sections ORDER BY name");
      res.json(rows);
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/with-warehouse", async (req, res) => {
  try {
    const ids = ((req.query.ids as string) || "").split(",").filter(Boolean);
    if (ids.length === 0) {
      res.json([]);
      return;
    }
    const { rows } = await query(
      `SELECT s.id, s.name, s.warehouse_id, w.name AS warehouse_name
       FROM sections s LEFT JOIN warehouses w ON w.id = s.warehouse_id
       WHERE s.id = ANY($1)`,
      [ids],
    );
    // Transform to match the shape the frontend expects: { id, name, warehouse_id, warehouses: { name } }
    const result = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      warehouse_id: r.warehouse_id,
      warehouses: r.warehouse_name ? { name: r.warehouse_name } : null,
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { warehouse_id, name, color, x, y, width, height } = req.body;
    const { rows } = await query(
      `INSERT INTO sections (warehouse_id, name, color, x, y, width, height)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [warehouse_id, name, color ?? "#3b82f6", x ?? 0, y ?? 0, width ?? 100, height ?? 100],
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name, color, x, y, width, height } = req.body;
    const { rows } = await query(
      `UPDATE sections SET name=$1, color=$2, x=$3, y=$4, width=$5, height=$6, updated_at=now()
       WHERE id=$7 RETURNING *`,
      [name, color, x, y, width, height, req.params.id],
    );
    res.json(rows[0] ?? null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await query("DELETE FROM sections WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
