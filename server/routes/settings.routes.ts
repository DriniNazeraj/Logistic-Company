import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/exchange-rates", async (_req, res) => {
  try {
    const { rows } = await query("SELECT * FROM exchange_rates");
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/exchange-rates", async (req, res) => {
  try {
    const rates: { from_currency: string; to_currency: string; rate: number }[] = req.body;
    for (const r of rates) {
      await query(
        `INSERT INTO exchange_rates (from_currency, to_currency, rate)
         VALUES ($1, $2, $3)
         ON CONFLICT (from_currency, to_currency) DO UPDATE SET rate = $3`,
        [r.from_currency, r.to_currency, r.rate],
      );
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
