import { spawn } from "child_process";
import logger from "../lib/logger.js";

async function scanFileForViruses(filePath) {
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

export { scanFileForViruses };
