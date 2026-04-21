import { Router } from "express";
import multer from "multer";
import path from "path";
import { authMiddleware } from "../auth.js";

const storage = multer.diskStorage({
  destination: path.join(import.meta.dirname, "..", "uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.use(authMiddleware);

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "No file uploaded" });
    return;
  }
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

export default router;
