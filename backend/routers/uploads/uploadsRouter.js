import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import logger from "../../lib/logger.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";

const router = Router();

const uploadDirectory = path.resolve("./../Frontend/public/uploads");
try {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
} catch (error) {
  logger.error(error, "Could not create upload directory");
}

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, uploadDirectory);
  },
  filename: function (req, file, callback) {
    const ext = path.extname(file.originalname) || "";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    callback(null, name);
  },
});

const allowedMimes = new Set(["image/png", "image/jpeg"]);
function fileFilter(req, file, callback) {
  if (allowedMimes.has(file.mimetype)) return callback(null, true);
  const error = new Error("Invalid file type");
  error.code = "INVALID_FILE_TYPE";
  return callback(error, false);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/api/uploads", isLoggedIn, (req, res) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE")
        return res.status(400).json({ message: "File too large (max 5MB)" });
      if (error.code === "INVALID_FILE_TYPE")
        return res.status(400).json({ message: "Invalid file type. Only PNG and JPEG allowed" });
      logger.error(error, "POST /api/uploads multer error");
      return res.status(500).json({ message: "Upload failed" });
    }

    try {
      if (!req.file) return res.status(400).json({ message: "No file" });
      const filename = req.file.filename;
      const frontendOrigin = process.env.FRONTEND_ORIGIN || "";
      const url = `${frontendOrigin.replace(/\/$/, "")}/uploads/${filename}`;
      return res.status(201).json({ url, filename });
    } catch (error) {
      logger.error(error, "POST /api/uploads error");
      return res.status(500).json({ message: "Upload failed" });
    }
  });
});

export default router;
