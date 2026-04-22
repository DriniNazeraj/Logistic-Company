import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = Router();

/**
 * Auto-create or update a client record from package client fields.
 * Matches on id_number first, then email. Creates if no match found.
 */
async function upsertClientFromPackage(b: any) {
  const name = b.client_name?.trim();
  if (!name) return; // no client info, skip

  const idNum = b.client_id_number?.trim() || null;
  const email = b.client_email?.trim() || null;
  const phone = b.client_phone?.trim() || null;

  // Try to find existing client by id_number or email
  let existing = null;
  if (idNum) {
    const { rows } = await query("SELECT id FROM clients WHERE id_number = $1 LIMIT 1", [idNum]);
    existing = rows[0] ?? null;
  }
  if (!existing && email) {
    const { rows } = await query("SELECT id FROM clients WHERE email = $1 LIMIT 1", [email]);
    existing = rows[0] ?? null;
  }

  if (existing) {
    // Update existing client with latest info
    await query(
      `UPDATE clients SET name = $1, phone = COALESCE($2, phone), email = COALESCE($3, email),
       id_number = COALESCE($4, id_number), updated_at = now() WHERE id = $5`,
      [name, phone, email, idNum, existing.id],
    );
  } else {
    // Create new client
    await query(
      `INSERT INTO clients (name, phone, email, id_number) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id_number) DO UPDATE SET name = $1, phone = COALESCE($2, clients.phone),
       email = COALESCE($3, clients.email), updated_at = now()`,
      [name, phone, email, idNum],
    );
  }
}

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
    // Auto-create/update client from package info
    await upsertClientFromPackage(b).catch(() => {});
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
    // Auto-create/update client from package info
    if (b.client_name) await upsertClientFromPackage(b).catch(() => {});
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
