import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import logger from '../../lib/logger.js';

const router = Router();

const uploadDirectory = path.resolve('./../Frontend/public/uploads');
try {
  fs.mkdirSync(uploadDirectory, {
    recursive: true
  });
} catch (error) {
  logger.error(error, 'Could not create upload directory');
}

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, uploadDirectory);
  },
  filename: function (req, file, callback) {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
    callback(null, name);
  }
});

const upload = multer({ storage });

router.post('/api/uploads', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    const filename = req.file.filename;
    const frontendOrigin = process.env.FRONTEND_ORIGIN;
    const url = `${frontendOrigin.replace(/\/$/, '')}/uploads/${filename}`;
    return res.status(201).json({ url, filename });
  } catch (error) {
    logger.error(error, 'POST /api/uploads error');
    return res.status(500).json({ message: 'Upload failed' });
  }
});

export default router;
