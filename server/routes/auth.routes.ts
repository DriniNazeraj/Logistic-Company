import { Router } from "express";
import rateLimit from "express-rate-limit";
import { findUserByEmail, createUser, comparePassword, signToken, authMiddleware, type AuthRequest } from "../auth.js";
import { loginSchema, registerSchema, validate } from "../validation.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

router.post("/login", loginLimiter, validate(loginSchema), async (req, res) => {
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

// Registration disabled — single admin user is seeded via db-init
router.post("/register", (_req, res) => {
  res.status(403).json({ message: "Registration is disabled" });
});

router.get("/me", authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

export default router;
