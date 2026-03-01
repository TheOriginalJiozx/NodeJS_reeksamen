import { fetchAvailability } from "../fetchers/bookingFetchers.js";
import logger from "../lib/logger.js";

async function loadAvailability(resourceId) {
  if (!resourceId) {
    return { availability: [], availableDates: [] };
  }
  try {
    const fetch = await fetchAvailability(resourceId);
    return {
      availability: fetch.availability || [],
      availableDates: fetch.availableDates || [],
    };
  } catch (error) {
    logger.error("Failed to load availability", error?.message || error);
    return { availability: [], availableDates: [] };
  }
}

async function submitAvailability(available, handleAddAvailability) {
  if (!available.startDate || !available.endDate) {
    return { ok: false, message: "Select both start and end dates" };
  }
  return await handleAddAvailability(available);
}

export { loadAvailability, submitAvailability };
