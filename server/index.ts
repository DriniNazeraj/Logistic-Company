import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import path from "path";
import { isDatabaseAvailable } from "./db.js";

import authRoutes from "./routes/auth.routes.js";
import cargosRoutes from "./routes/cargos.routes.js";
import packagesRoutes from "./routes/packages.routes.js";
import warehousesRoutes from "./routes/warehouses.routes.js";
import sectionsRoutes from "./routes/sections.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static(path.join(import.meta.dirname, "uploads")));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/cargos", cargosRoutes);
app.use("/api/packages", packagesRoutes);
app.use("/api/warehouses", warehousesRoutes);
app.use("/api/sections", sectionsRoutes);
app.use("/api/upload", uploadRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", database: isDatabaseAvailable() });
});

// Catch DB-not-available errors so the server doesn't crash
const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err.message === "Database is not available") {
    res.status(503).json({ error: "Database is not available. Please install and configure PostgreSQL." });
    return;
  }
  next(err);
};
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
