import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = Router();

router.use(authMiddleware);

// List all clients with their total spending
router.get("/", async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.*,
        COALESCE(s.total_packages, 0)::int AS total_packages,
        COALESCE(s.total_spent_eur, 0)::numeric AS total_spent_eur,
        COALESCE(s.total_spent_usd, 0)::numeric AS total_spent_usd,
        COALESCE(s.total_spent_all, 0)::numeric AS total_spent_all
      FROM clients c
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS total_packages,
          SUM(CASE WHEN p.currency = 'EUR' THEN p.price ELSE 0 END) AS total_spent_eur,
          SUM(CASE WHEN p.currency = 'USD' THEN p.price ELSE 0 END) AS total_spent_usd,
          SUM(CASE WHEN p.currency = 'ALL' THEN p.price ELSE 0 END) AS total_spent_all
        FROM packages p
        WHERE p.client_id_number = c.id_number
           OR (p.client_email = c.email AND c.email IS NOT NULL AND c.email <> '')
      ) s ON true
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get single client with their packages
router.get("/:id", async (req, res) => {
  try {
    const { rows: clients } = await query("SELECT * FROM clients WHERE id = $1", [req.params.id]);
    if (clients.length === 0) {
      res.status(404).json({ message: "Client not found" });
      return;
    }
    const client = clients[0];

    // Get all packages linked to this client
    const { rows: packages } = await query(
      `SELECT p.*, c.cargo_code
       FROM packages p
       LEFT JOIN cargos c ON c.id = p.cargo_id
       WHERE p.client_id_number = $1
          OR (p.client_email = $2 AND $2 IS NOT NULL AND $2 <> '')
       ORDER BY p.created_at DESC`,
      [client.id_number, client.email],
    );

    res.json({ client, packages });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Create client
router.post("/", async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO clients (name, phone, email, id_number, address, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [b.name, b.phone || null, b.email || null, b.id_number || null, b.address || null, b.notes || null],
    );
    res.json(rows[0]);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ message: "A client with this ID number already exists." });
      return;
    }
    res.status(500).json({ message: err.message });
  }
});

// Update client
router.put("/:id", async (req, res) => {
  try {
    const b = req.body;
    const allowed = ["name", "phone", "email", "id_number", "address", "notes"];
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
    sets.push("updated_at = now()");
    vals.push(req.params.id);
    const { rows } = await query(
      `UPDATE clients SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      vals,
    );
    res.json(rows[0] ?? null);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ message: "A client with this ID number already exists." });
      return;
    }
    res.status(500).json({ message: err.message });
  }
});

// Delete client
router.delete("/:id", async (req, res) => {
  try {
    await query("DELETE FROM clients WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
