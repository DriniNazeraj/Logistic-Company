import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";
import { createPackageSchema, updatePackageSchema, validate, validateId } from "../validation.js";

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

/**
 * Add a package's price to the client's persistent spending totals.
 * Finds client by id_number or email (same logic as upsertClientFromPackage).
 */
async function addSpendingToClient(pkg: any) {
  const idNum = pkg.client_id_number?.trim() || null;
  const email = pkg.client_email?.trim() || null;
  const price = parseFloat(pkg.price) || 0;
  const currency = (pkg.currency || "EUR").toUpperCase();
  if (price === 0) return;

  const col =
    currency === "EUR" ? "total_spent_eur" :
    currency === "USD" ? "total_spent_usd" :
    currency === "ALL" ? "total_spent_all" : null;
  if (!col) return;

  const conditions: string[] = [];
  const vals: any[] = [price];
  let i = 2;
  if (idNum) { conditions.push(`id_number = $${i++}`); vals.push(idNum); }
  if (email) { conditions.push(`(email = $${i++} AND email IS NOT NULL AND email <> '')`); vals.push(email); }
  if (conditions.length === 0) return;

  await query(
    `UPDATE clients SET ${col} = ${col} + $1, total_packages = total_packages + 1, updated_at = now()
     WHERE ${conditions.join(" OR ")}`,
    vals,
  );
}

/**
 * When a package's price or currency changes, subtract the old spending and add the new.
 * Uses the old package data (before update) and the new values.
 */
async function adjustClientSpending(oldPkg: any, newPrice: number, newCurrency: string) {
  const idNum = oldPkg.client_id_number?.trim() || null;
  const email = oldPkg.client_email?.trim() || null;

  const conditions: string[] = [];
  const condVals: any[] = [];
  let idx = 1;
  if (idNum) { conditions.push(`id_number = $${idx++}`); condVals.push(idNum); }
  if (email) { conditions.push(`(email = $${idx++} AND email IS NOT NULL AND email <> '')`); condVals.push(email); }
  if (conditions.length === 0) return;

  const where = conditions.join(" OR ");

  // Subtract old spending
  const oldPrice = parseFloat(oldPkg.price) || 0;
  const oldCurrency = (oldPkg.currency || "EUR").toUpperCase();
  const oldCol =
    oldCurrency === "EUR" ? "total_spent_eur" :
    oldCurrency === "USD" ? "total_spent_usd" :
    oldCurrency === "ALL" ? "total_spent_all" : null;

  if (oldCol && oldPrice > 0) {
    await query(
      `UPDATE clients SET ${oldCol} = GREATEST(${oldCol} - $${idx}, 0), updated_at = now() WHERE ${where}`,
      [...condVals, oldPrice],
    );
  }

  // Add new spending
  const newCol =
    newCurrency === "EUR" ? "total_spent_eur" :
    newCurrency === "USD" ? "total_spent_usd" :
    newCurrency === "ALL" ? "total_spent_all" : null;

  if (newCol && newPrice > 0) {
    await query(
      `UPDATE clients SET ${newCol} = ${newCol} + $${idx}, updated_at = now() WHERE ${where}`,
      [...condVals, newPrice],
    );
  }
}

// Public tracking endpoint (no auth) — looks up by track_token (secure) or package_code (legacy)
router.get("/track/:token", async (req, res) => {
  try {
    // Try track_token first (48-char hex), fall back to package_code for backwards compat
    const token = req.params.token;
    const { rows: pkgs } = await query(
      "SELECT * FROM packages WHERE track_token = $1 OR package_code = $1 LIMIT 1",
      [token],
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
    console.error("[packages track]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Public confirm delivery endpoint (no auth)
// Client scans QR on the physical box; the scanned token must match the package's track_token.
router.post("/confirm/:token", async (req, res) => {
  try {
    const scanned_code = typeof req.body?.scanned_code === "string"
      ? req.body.scanned_code.trim().slice(0, 500)
      : null;
    if (!scanned_code) {
      res.status(400).json({ message: "No scanned code provided" });
      return;
    }
    // Look up the package by the URL token
    const { rows } = await query(
      "SELECT id, package_code, track_token, confirmed_at FROM packages WHERE track_token = $1 OR package_code = $1 LIMIT 1",
      [req.params.token],
    );
    if (rows.length === 0) {
      res.status(404).json({ message: "Package not found" });
      return;
    }
    const pkg = rows[0];
    // The scanned QR must contain the same token OR matching package code
    const scannedMatches =
      scanned_code === pkg.track_token ||
      scanned_code === pkg.package_code;
    if (!scannedMatches) {
      res.status(400).json({ message: "Scanned package does not match. This is not your package." });
      return;
    }
    if (pkg.confirmed_at) {
      res.json({ already: true, confirmed_at: pkg.confirmed_at });
      return;
    }
    // Fetch full package data so we can preserve client info and spending before deleting
    const { rows: fullPkg } = await query("SELECT * FROM packages WHERE id = $1", [pkg.id]);
    if (fullPkg.length > 0) {
      // Ensure client record is saved and spending is accumulated before deleting
      await upsertClientFromPackage(fullPkg[0]).catch((err) => console.error("[upsertClient:confirm]", err));
    }
    // Delete the package from the database
    await query("DELETE FROM packages WHERE id = $1", [pkg.id]);
    res.json({ confirmed: true, confirmed_at: new Date().toISOString() });
  } catch (err: any) {
    console.error("[packages confirm]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.use(authMiddleware);

const ALLOWED_PACKAGE_FIELDS = new Set([
  "id", "package_code", "product_name", "price", "currency", "payment_status",
  "amount_paid", "amount_remaining", "client_name", "client_phone", "client_email",
  "client_id_number", "destination_location", "delivery_date", "arrival_date",
  "image_url", "cargo_id", "section_id", "track_token", "confirmed_at", "created_at", "updated_at",
]);

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const fields = req.query.fields as string | undefined;
    let selectClause = "*";
    if (fields) {
      const requested = fields.split(",").map((f) => f.trim()).filter((f) => ALLOWED_PACKAGE_FIELDS.has(f));
      if (requested.length === 0) {
        res.status(400).json({ message: "No valid fields specified" });
        return;
      }
      selectClause = requested.join(", ");
    }
    const [{ rows }, { rows: countRows }] = await Promise.all([
      query(`SELECT ${selectClause} FROM packages ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
      query("SELECT COUNT(*)::int AS total FROM packages"),
    ]);
    res.json({ data: rows, total: countRows[0].total, page, limit });
  } catch (err: any) {
    console.error("[packages GET /]", err);
    res.status(500).json({ message: "Internal server error" });
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
    console.error("[packages]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", validate(createPackageSchema), async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO packages (package_code, product_name, price, currency, payment_status,
       amount_paid, amount_remaining,
       client_name, client_phone, client_email, client_id_number,
       destination_location, delivery_date, arrival_date, image_url, cargo_id, section_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [
        b.package_code, b.product_name, b.price ?? 0, b.currency ?? "EUR", b.payment_status ?? "paid",
        b.amount_paid, b.amount_remaining,
        b.client_name, b.client_phone, b.client_email, b.client_id_number,
        b.destination_location, b.delivery_date, b.arrival_date, b.image_url, b.cargo_id, b.section_id,
      ],
    );
    // Auto-create/update client from package info, then add spending
    await upsertClientFromPackage(b).catch((err) => console.error("[upsertClient:create]", err));
    await addSpendingToClient(rows[0]).catch((err) => console.error("[addSpending:create]", err));
    res.json(rows[0]);
  } catch (err: any) {
    console.error("[packages]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", validateId, validate(updatePackageSchema), async (req, res) => {
  try {
    const b = req.body;

    // Fetch old package to compare price/currency changes
    const { rows: oldRows } = await query("SELECT * FROM packages WHERE id = $1", [req.params.id]);
    if (oldRows.length === 0) {
      res.status(404).json({ message: "Package not found" });
      return;
    }
    const oldPkg = oldRows[0];

    // Build dynamic SET clause from provided fields
    const allowed = [
      "package_code", "product_name", "price", "currency", "payment_status",
      "amount_paid", "amount_remaining",
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

    const updated = rows[0];
    // Auto-create/update client from package info
    if (b.client_name) await upsertClientFromPackage(b).catch((err) => console.error("[upsertClient:update]", err));

    // Recalculate client spending if price or currency changed
    const priceChanged = "price" in b && parseFloat(b.price) !== (parseFloat(oldPkg.price) || 0);
    const currencyChanged = "currency" in b && b.currency !== oldPkg.currency;
    if (priceChanged || currencyChanged) {
      const newPrice = parseFloat(updated.price) || 0;
      const newCurrency = (updated.currency || "EUR").toUpperCase();
      await adjustClientSpending(oldPkg, newPrice, newCurrency).catch((err) => console.error("[adjustSpending:update]", err));
    }

    res.json(updated);
  } catch (err: any) {
    console.error("[packages]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", validateId, async (req, res) => {
  try {
    await query("DELETE FROM packages WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[packages]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
