import logger from "../lib/logger.js";

const uploadLimits = new Map();
const MAX_UPLOADS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

function checkUploadLimit(userId) {
  const now = Date.now();
  if (!uploadLimits.has(userId)) {
    uploadLimits.set(userId, []);
  }
  
  const userUploads = uploadLimits.get(userId);
  const recentUploads = userUploads.filter(time => now - time < HOUR_MS);
  uploadLimits.set(userId, recentUploads);
  
  if (recentUploads.length >= MAX_UPLOADS_PER_HOUR) {
    return false;
  }
  
  recentUploads.push(now);
  return true;
}

export { checkUploadLimit, MAX_UPLOADS_PER_HOUR };
