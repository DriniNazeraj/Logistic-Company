import { Router } from "express";
import { query } from "../db.js";
import { authMiddleware } from "../auth.js";
import { exchangeRatesSchema, validate } from "../validation.js";

const router = Router();
router.use(authMiddleware);

router.get("/exchange-rates", async (_req, res) => {
  try {
    const { rows } = await query("SELECT * FROM exchange_rates");
    res.json(rows);
  } catch (err: any) {
    console.error("[settings]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/exchange-rates", validate(exchangeRatesSchema), async (req, res) => {
  try {
    const rates = req.body;
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
    console.error("[settings]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
