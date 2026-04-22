import { Router } from "express";
import rateLimit from "express-rate-limit";
import { findUserByEmail, createUser, comparePassword, signToken, authMiddleware, type AuthRequest } from "../auth.js";
import { loginSchema, registerSchema, validate } from "../validation.js";

const router = Router();

// Strict rate limits on auth endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false });
router.use(authLimiter);

router.post("/login", validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);
    if (!user || !(await comparePassword(password, user.password_hash))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }
    const token = signToken({ id: user.id, email: user.email });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err: any) {
    console.error("[auth]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/register", validate(registerSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ message: "User already exists" });
      return;
    }
    const user = await createUser(email, password);
    const token = signToken(user);
    res.json({ token, user });
  } catch (err: any) {
    console.error("[auth]", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/me", authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

export default router;
