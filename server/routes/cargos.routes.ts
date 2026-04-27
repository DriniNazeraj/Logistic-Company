import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";
import { createCargoSchema, updateCargoSchema, validate, validateId } from "../validation.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const [{ rows }, { rows: countRows }] = await Promise.all([
      query("SELECT * FROM cargos ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]),
      query("SELECT COUNT(*)::int AS total FROM cargos"),
    ]);
    res.json({ data: rows, total: countRows[0].total, page, limit });
  } catch (err: any) {
    console.error("[cargos]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/stats", async (_req, res) => {
  try {
    const [total, inTransit, warehouses] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM cargos"),
      query("SELECT COUNT(*)::int AS count FROM cargos WHERE status = 'in_transit'"),
      query("SELECT COUNT(*)::int AS count FROM warehouses"),
    ]);
    res.json({
      total: total.rows[0].count,
      inTransit: inTransit.rows[0].count,
      warehouses: warehouses.rows[0].count,
    });
  } catch (err: any) {
    console.error("[cargos]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/auto-transit", async (_req, res) => {
  try {
    const { rows } = await query(
      "SELECT id, departure_date FROM cargos WHERE status = 'pending' AND departure_date IS NOT NULL",
    );
    const now = new Date();
    const ids = rows
      .filter((c: any) => {
        const noon = new Date(c.departure_date + "T12:00:00");
        return now >= noon;
      })
      .map((c: any) => c.id);
    if (ids.length > 0) {
      await query(
        "UPDATE cargos SET status = 'in_transit', updated_at = now() WHERE id = ANY($1)",
        [ids],
      );
    }
    res.json({ transitioned: ids.length });
  } catch (err: any) {
    console.error("[cargos]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", validateId, async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM cargos WHERE id = $1", [req.params.id]);
    res.json(rows[0] ?? null);
  } catch (err: any) {
    console.error("[cargos]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", validate(createCargoSchema), async (req, res) => {
  try {
    const { cargo_code, departure_country, destination_country, departure_date, arrival_date, status, currency } = req.body;
    const { rows } = await query(
      `INSERT INTO cargos (cargo_code, departure_country, destination_country, departure_date, arrival_date, status, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [cargo_code, departure_country, destination_country, departure_date, arrival_date, status, currency],
    );
    res.json(rows[0]);
  } catch (err: any) {
    console.error("[cargos]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", validateId, validate(updateCargoSchema), async (req, res) => {
  try {
    const b = req.body;
    const allowed = ["cargo_code", "departure_country", "destination_country", "departure_date", "arrival_date", "status", "currency"];
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
      `UPDATE cargos SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      vals,
    );
    res.json(rows[0] ?? null);
  } catch (err: any) {
    console.error("[cargos]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", validateId, async (req, res) => {
  try {
    await query("DELETE FROM cargos WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[cargos]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
