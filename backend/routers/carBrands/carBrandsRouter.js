import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/carBrands.js";
import logger from "../../lib/logger.js";

const router = Router();
const API = "/api";

const sendServerError = (res, tag, error) => {
  logger.error(error, tag);
  return res.status(500).json({ message: "Internal server error" });
};

router.get(`${API}/car-brands`, async (req, res) => {
  try {
    const result = await db.query(queries.getAllBrands);
    return res.status(200).json(result.rows || []);
  } catch (error) {
    return sendServerError(res, "GET /api/car-brands error", error);
  }
});

router.get(`${API}/car-brands/:brandId/models`, async (req, res) => {
  try {
    const brandId = req.params.brandId;
    if (!brandId || !/^\d+$/.test(String(brandId))) {
      return res.status(400).json({ message: "Invalid brand id" });
    }
    const result = await db.query(queries.getModelsByBrandId, [brandId]);
    return res.status(200).json(result.rows || []);
  } catch (error) {
    return sendServerError(res, "GET /api/car-brands/:brandId/models error", error);
  }
});

export default router;
