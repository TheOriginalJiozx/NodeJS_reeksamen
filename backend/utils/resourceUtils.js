import logger from "../lib/logger.js";
import fs from "fs";
import path from "path";
import { datesBetween } from "./dateUtils.js";

const deleteUploadFile = (image) => {
  if (!image || !String(image).includes("/uploads/")) return;
  try {
    const filename = String(image).split("/uploads/").pop();
    const uploadPath = path.resolve("./Frontend/public/uploads", filename);
    if (fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);
  } catch (error) {
    logger.debug("Failed removing upload file", error);
  }
};

export { deleteUploadFile, datesBetween };
