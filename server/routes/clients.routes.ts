import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";
import { createClientSchema, updateClientSchema, validate } from "../validation.js";

const router = Router();

router.use(authMiddleware);

// List all clients with pagination
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const [{ rows }, { rows: countRows }] = await Promise.all([
      query("SELECT * FROM clients ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]),
      query("SELECT COUNT(*)::int AS total FROM clients"),
    ]);
    res.json({ data: rows, total: countRows[0].total, page, limit });
  } catch (err: any) {
    console.error("[clients]", err);
    res.status(500).json({ message: "Internal server error" });
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
    console.error("[clients]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Create client
router.post("/", validate(createClientSchema), async (req, res) => {
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
    console.error("[clients]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update client
router.put("/:id", validate(updateClientSchema), async (req, res) => {
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
    console.error("[clients]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Delete client
router.delete("/:id", async (req, res) => {
  try {
    await query("DELETE FROM clients WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[clients]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
