import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import logger from "../../lib/logger.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import { spawn } from "child_process";

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
  destination: function (_req, _file, callback) {
    callback(null, uploadDirectory);
  },
  filename: function (_req, file, callback) {
    const extension = path.extname(file.originalname) || "";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
    callback(null, name);
  },
});

const allowedMimes = new Set(["image/png", "image/jpeg"]);
function fileFilter(_req, file, callback) {
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

async function scanFileForViruses(filePath) {
  // spørgsmål: hvorfor bruger vi Promise her?
  // Vi bruger en Promise her for at gøre den callback-baserede spawn-metode kompatibel med async/await-syntaksen.
  // spawn forventer, at vi håndterer output og afslutning gennem callbacks, men ved at indpakke det i en Promise kan vi bruge await for at vente på resultatet,
  // hvilket gør koden mere læsbar og lettere at håndtere i tilfælde af fejl.
  return new Promise((resolve) => {
    try {
      const clamscan = spawn("clamscan", ["--quiet", filePath]);
      let output = "";
      let error = "";

      clamscan.stdout.on("data", (data) => {
        output += data.toString();
      });

      clamscan.stderr.on("data", (data) => {
        error += data.toString();
      });

      clamscan.on("error", (error) => {
        logger.warn("ClamAV not found - skipping virus scan (install ClamAV for production):", error.message);
        resolve({ clean: true, message: "ClamAV unavailable, file accepted" });
      });

      clamscan.on("close", (code) => {
        if (code === 0) {
          resolve({ clean: true, message: "File is clean" });
        } else if (code === 1) {
          logger.warn(`Virus detected in file: ${filePath}`, { output });
          resolve({ clean: false, message: "Virus detected in file" });
        } else {
          logger.warn("ClamAV not available, allowing file (install ClamAV for production)", {
            error,
          });
          resolve({ clean: true, message: "ClamAV unavailable, file accepted" });
        }
      });
    } catch (error) {
      logger.warn("Could not run ClamAV, allowing file:", error.message);
      resolve({ clean: true, message: "ClamAV unavailable, file accepted" });
    }
  });
}

router.post("/api/uploads", isLoggedIn, (req, res) => {
  upload.single("file")(req, res, async (error) => {
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
      const frontendOrigin = process.env.FRONTEND_ORIGIN || "";
      const url = `${frontendOrigin.replace(/\/$/, "")}/api/uploads/${filename}`;
      return res.status(201).json({ url, filename });
    } catch (error) {
      logger.error(error, "POST /api/uploads error");
      return res.status(500).json({ message: "Upload failed" });
    }
  });
});

router.get("/api/uploads/:filename", (req, res) => {
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
