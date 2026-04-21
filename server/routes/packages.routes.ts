import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = Router();

// Public tracking endpoint (no auth)
router.get("/track/:code", async (req, res) => {
  try {
    const { rows: pkgs } = await query(
      "SELECT * FROM packages WHERE package_code = $1 LIMIT 1",
      [req.params.code],
    );
    if (pkgs.length === 0) {
      res.status(404).json({ message: "Package not found" });
      return;
    }
    const pkg = pkgs[0];
    let cargo = null;
    if (pkg.cargo_id) {
      const { rows } = await query(
        "SELECT cargo_code, departure_country, destination_country, status FROM cargos WHERE id = $1",
        [pkg.cargo_id],
      );
      cargo = rows[0] ?? null;
    }
    res.json({ package: pkg, cargo });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const fields = req.query.fields as string | undefined;
    const sql = fields
      ? `SELECT ${fields.split(",").map((f) => f.trim()).join(", ")} FROM packages ORDER BY created_at DESC`
      : "SELECT * FROM packages ORDER BY created_at DESC";
    const { rows } = await query(sql);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/by-cargo/:cargoId", async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT * FROM packages WHERE cargo_id = $1 ORDER BY created_at DESC",
      [req.params.cargoId],
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO packages (package_code, product_name, price, currency, payment_status,
       client_name, client_phone, client_email, client_id_number,
       destination_location, delivery_date, arrival_date, image_url, cargo_id, section_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        b.package_code, b.product_name, b.price ?? 0, b.currency ?? "EUR", b.payment_status ?? "paid",
        b.client_name, b.client_phone, b.client_email, b.client_id_number,
        b.destination_location, b.delivery_date, b.arrival_date, b.image_url, b.cargo_id, b.section_id,
      ],
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const b = req.body;
    // Build dynamic SET clause from provided fields
    const allowed = [
      "package_code", "product_name", "price", "currency", "payment_status",
      "client_name", "client_phone", "client_email", "client_id_number",
      "destination_location", "delivery_date", "arrival_date", "image_url", "cargo_id", "section_id",
    ];
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const key of allowed) {
      if (key in b) {
        sets.push(`${key} = $${i++}`);
        vals.push(b[key]);
      }
    }
    if (sets.length === 0) {
      res.json({ ok: true });
      return;
    }
    sets.push(`updated_at = now()`);
    vals.push(req.params.id);
    const { rows } = await query(
      `UPDATE packages SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      vals,
    );
    res.json(rows[0] ?? null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await query("DELETE FROM packages WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
