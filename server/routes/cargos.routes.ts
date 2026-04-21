import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (_req, res) => {
  try {
    const { rows } = await query(
      "SELECT * FROM cargos ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
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
    res.status(500).json({ message: err.message });
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
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM cargos WHERE id = $1", [req.params.id]);
    res.json(rows[0] ?? null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { cargo_code, departure_country, destination_country, departure_date, arrival_date, status, currency } = req.body;
    const { rows } = await query(
      `INSERT INTO cargos (cargo_code, departure_country, destination_country, departure_date, arrival_date, status, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [cargo_code, departure_country, destination_country, departure_date, arrival_date, status || "pending", currency || "EUR"],
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { cargo_code, departure_country, destination_country, departure_date, arrival_date, status, currency } = req.body;
    const { rows } = await query(
      `UPDATE cargos SET cargo_code=$1, departure_country=$2, destination_country=$3,
       departure_date=$4, arrival_date=$5, status=$6, currency=$7, updated_at=now()
       WHERE id=$8 RETURNING *`,
      [cargo_code, departure_country, destination_country, departure_date, arrival_date, status, currency, req.params.id],
    );
    res.json(rows[0] ?? null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await query("DELETE FROM cargos WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
