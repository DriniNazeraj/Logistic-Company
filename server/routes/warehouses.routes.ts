import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";
import { createWarehouseSchema, updateWarehouseSchema, validate, validateId } from "../validation.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (_req, res) => {
  try {
    const { rows } = await query("SELECT * FROM warehouses ORDER BY name");
    res.json(rows);
  } catch (err: any) {
    console.error("[warehouses]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/first", async (_req, res) => {
  try {
    const { rows } = await query("SELECT * FROM warehouses ORDER BY created_at ASC LIMIT 1");
    res.json(rows[0] ?? null);
  } catch (err: any) {
    console.error("[warehouses]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", validate(createWarehouseSchema), async (req, res) => {
  try {
    const { name, location, canvas_width, canvas_height } = req.body;
    const { rows } = await query(
      `INSERT INTO warehouses (name, location, canvas_width, canvas_height)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, location, canvas_width, canvas_height],
    );
    res.json(rows[0]);
  } catch (err: any) {
    console.error("[warehouses]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", validateId, validate(updateWarehouseSchema), async (req, res) => {
  try {
    const b = req.body;
    const allowed = ["name", "location", "canvas_width", "canvas_height"];
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const key of allowed) {
      if (key in b) {
        sets.push(`${key} = $${i++}`);
        vals.push(b[key]);
      }
    }
    if (sets.length === 0) { res.json({ ok: true }); return; }
    sets.push(`updated_at = now()`);
    vals.push(req.params.id);
    const { rows } = await query(
      `UPDATE warehouses SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      vals,
    );
    res.json(rows[0] ?? null);
  } catch (err: any) {
    console.error("[warehouses]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", validateId, async (req, res) => {
  try {
    await query("DELETE FROM warehouses WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[warehouses]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
