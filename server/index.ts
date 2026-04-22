import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { isDatabaseAvailable, shutdown as dbShutdown } from "./db.js";

import authRoutes from "./routes/auth.routes.js";
import cargosRoutes from "./routes/cargos.routes.js";
import packagesRoutes from "./routes/packages.routes.js";
import warehousesRoutes from "./routes/warehouses.routes.js";
import sectionsRoutes from "./routes/sections.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import clientsRoutes from "./routes/clients.routes.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// Trust proxy (nginx) so rate limiter sees real client IPs
app.set("trust proxy", 1);

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Request logging
app.use(morgan("short"));

// Global rate limit: 200 requests per minute per IP
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3001"];
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

// Body parser with size limit
app.use(express.json({ limit: "1mb" }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(import.meta.dirname, "uploads")));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/cargos", cargosRoutes);
app.use("/api/packages", packagesRoutes);
app.use("/api/warehouses", warehousesRoutes);
app.use("/api/sections", sectionsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/clients", clientsRoutes);

app.get("/api/health", (_req, res) => {
  const dbOk = isDatabaseAvailable();
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? "ok" : "degraded", database: dbOk });
});

// Global error handler — never leak internal details to the client
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err.message === "Database is not available") {
    res.status(503).json({ message: "Database is not available. Please install and configure PostgreSQL." });
    return;
  }
  console.error("[server error]", err);
  res.status(500).json({ message: "Internal server error" });
};
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
function gracefulShutdown(signal: string) {
  console.log(`${signal} received — shutting down gracefully…`);
  server.close(async () => {
    console.log("HTTP server closed.");
    await dbShutdown();
    console.log("Database pool closed.");
    process.exit(0);
  });
  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
