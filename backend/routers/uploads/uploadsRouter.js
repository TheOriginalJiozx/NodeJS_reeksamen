import { Router } from "express";
import fs from "fs";
import path from "path";
import logger from "../../lib/logger.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import { upload, uploadDirectory } from "../../middleware/uploadMiddleware.js";
import { checkUploadLimit } from "../../utils/uploadLimitUtils.js";
import { scanFileForViruses } from "../../utils/virusScanUtils.js";

const router = Router();
const API = "/api";

router.post(`${API}/uploads`, isLoggedIn, (req, res) => {
  const userId = req.user?.id;
  if (!userId || !checkUploadLimit(userId)) {
    return res.status(429).json({ message: "Upload limit exceeded. Max 10 uploads per hour" });
  }

  upload.single("file")(req, res, async (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE")
        return res.status(400).json({ message: "File too large (max 25MB)" });
      if (error.code === "INVALID_FILE_TYPE")
        return res.status(400).json({ message: "Invalid file type. Only PNG and JPEG allowed" });
      logger.error(error, "POST /api/uploads multer error");
      return res.status(500).json({ message: "Upload failed" });
    }

    try {
      if (!req.file) return res.status(400).json({ message: "No file" });

      const scanResult = await scanFileForViruses(req.file.path);
      if (!scanResult.clean) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logger.error(unlinkError, "Could not delete infected file");
        }
        logger.warn("Infected file rejected", { filename: req.file.filename });
        return res.status(400).json({ message: "File rejected: " + scanResult.message });
      }

      const filename = req.file.filename;
      const frontendOrigin = process.env.FRONTEND_ORIGIN;
      const url = `${frontendOrigin.replace(/\/$/, "")}${API}/uploads/${filename}`;
      return res.status(201).json({ url, filename });
    } catch (error) {
      logger.error(error, "POST /api/uploads error");
      return res.status(500).json({ message: "Upload failed" });
    }
  });
});

router.get(`${API}/uploads/:filename`, (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadDirectory, filename);

    if (!filePath.startsWith(uploadDirectory)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    res.sendFile(filePath);
  } catch (error) {
    logger.error(error, "GET /api/uploads/:filename error");
    return res.status(500).json({ message: "Download failed" });
  }
});

export default router;
