import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "./db.js";
import type { Request, Response, NextFunction } from "express";

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required. Set it in your .env file.");
  process.exit(1);
}
const SECRET = process.env.JWT_SECRET;

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, SECRET) as { sub: string; email: string };
  return { id: payload.sub, email: payload.email };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or invalid token" });
    return;
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export async function findUserByEmail(email: string) {
  const { rows } = await query("SELECT id, email, password_hash FROM users WHERE email = $1", [email]);
  return rows[0] ?? null;
}

export async function createUser(email: string, password: string): Promise<AuthUser> {
  const hash = await hashPassword(password);
  const { rows } = await query(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
    [email, hash],
  );
  return rows[0];
}
