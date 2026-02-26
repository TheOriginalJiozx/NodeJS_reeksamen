import logger from "../lib/logger.js";
import fs from "fs";
import path from "path";

const sendServerError = (res, tag, error) => {
  logger.error(error, tag);
  return res.status(500).json({ message: "Internal server error" });
};

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

const datesBetween = (startString, endString) => {
  const output = [];
  const [startYear, startMonth, startDay] = String(startString).split("-").map(Number);
  const [endYear, endMonth, endDay] = String(endString).split("-").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    output.push(`${year}-${month}-${day}`);
  }
  return output;
};

export { sendServerError, deleteUploadFile, datesBetween };
