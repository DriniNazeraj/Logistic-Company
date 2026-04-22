import { Router } from "express";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import { authMiddleware } from "../auth.js";

const storage = multer.diskStorage({
  destination: path.join(import.meta.dirname, "..", "uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${crypto.randomUUID()}${ext}`;
    cb(null, name);
  },
});

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}. Only images are accepted.`));
    }
  },
});

const router = Router();
router.use(authMiddleware);

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "No file uploaded" });
    return;
  }
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  const url = `${baseUrl}/uploads/${req.file.filename}`;
  res.json({ url });
});

export default router;
