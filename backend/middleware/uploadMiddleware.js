import multer from "multer";
import path from "path";
import fs from "fs";
import logger from "../lib/logger.js";

const uploadDirectory = path.resolve("./../frontend/public/uploads");

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
    const extension = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
    callback(null, name);
  },
});

const allowedMimes = new Set(["image/png", "image/jpeg", "image/jpg"]);

function fileFilter(_req, file, callback) {
  if (allowedMimes.has(file.mimetype)) return callback(null, true);
  const error = new Error("Invalid file type");
  error.code = "INVALID_FILE_TYPE";
  return callback(error, false);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

export { upload, uploadDirectory };
