import { apiFetch } from "../lib/api.js";
import logger from "../lib/logger.js";

async function fetchDefectCount() {
  try {
    const res = await apiFetch("/api/bookings/defected-count", { credentials: "include" });
    
    if (res.status === 401 || res.status === 403) {
      return { ok: false, count: 0 };
    }

    if (!res.ok) {
      logger.warn("Failed to fetch defect count", `Status: ${res.status}`);
      return { ok: false, count: 0 };
    }

    const data = await res.json();
    return { ok: true, count: data.defectCount || 0 };
  } catch (error) {
    logger.error("Failed to fetch defect count", error?.message || error);
    return { ok: false, count: 0 };
  }
}

export { fetchDefectCount };
