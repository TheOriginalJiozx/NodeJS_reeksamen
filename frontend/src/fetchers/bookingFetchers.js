import logger from "../lib/logger.js";
import { apiFetch } from "../lib/api.js";
import bookingUtils from "../utils/bookingUtils.js";

const API = "/api";

function computeDatesFromAvailabilities(availableDates) {
  const set = new Set();
  for (const available of availableDates || []) {
    if (!available.startDate || !available.endDate) continue;
    const start = new Date(available.startDate);
    const end = new Date(available.endDate);
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      set.add(`${year}-${month}-${day}`);
    }
  }
  return Array.from(set).sort();
}

async function fetchAllResources() {
  const res = await apiFetch(`${API}/resources`, { credentials: "include" });
  const resourcesAll = res.ok ? await res.json() : [];
  const availableResourceIds = new Set();

  for (const resource of resourcesAll) {
    try {
      const res = await apiFetch(`${API}/resources/${resource.id}/availabilities`, {
        credentials: "include",
      });
      if (!res.ok) continue;
      const data = await res.json();
      let availableDates = [];
      if (Array.isArray(data)) availableDates = data;
      else if (Array.isArray(data.availableDates)) availableDates = data.availableDates;
      else if (Array.isArray(data.availabilities))
        availableDates = computeDatesFromAvailabilities(data.availabilities);
      if (availableDates.length > 0) availableResourceIds.add(String(resource.id));
    } catch (error) {
      logger.warn(
        `Failed to fetch availability for resource ${resource.id}`,
        error && error.message ? error.message : error,
      );
    }
  }

  const firstBookable = resourcesAll.find((resource) =>
    availableResourceIds.has(String(resource.id)),
  );
  return {
    resourcesAll,
    availableResourceIds: Array.from(availableResourceIds),
    firstBookableId: firstBookable ? firstBookable.id : null,
  };
}

async function fetchTypes() {
  const res = await apiFetch(`${API}/types`, {
    credentials: "include",
  });
  const types = res.ok ? await res.json() : [];
  return types;
}

async function fetchAvailability(id) {
  if (!id) return { availability: [], availableDates: [], availableRanges: [] };
  const res = await apiFetch(`${API}/resources/${id}/availabilities`, {
    credentials: "include",
  });
  const raw = res.ok ? await res.json() : null;
  if (!raw) return { availability: [], availableDates: [], availableRanges: [] };

  let availability = [];
  let availableDates = [];

  if (Array.isArray(raw)) {
    availability = raw.map((available) => ({
      id: available.id,
      startDate: available.startDate
        ? available.startDate.length >= 10
          ? available.startDate.substring(0, 10)
          : available.startDate
        : null,
      endDate: available.endDate
        ? available.endDate.length >= 10
          ? available.endDate.substring(0, 10)
          : available.endDate
        : null,
    }));
    availableDates = computeDatesFromAvailabilities(availability);
  } else if (raw.availableDates) {
    availability = (raw.availabilities || []).map((available) => ({
      id: available.id,
      startDate: available.startDate,
      endDate: available.endDate,
    }));
    availableDates = Array.isArray(raw.availableDates) ? raw.availableDates : [];
  } else if (raw.availabilities) {
    availability = (raw.availabilities || []).map((available) => ({
      startDate: available.startDate,
      endDate: available.endDate,
    }));
    availableDates = computeDatesFromAvailabilities(availability);
  }

    const availableRanges = bookingUtils.groupContinuousDates(availableDates);
  return { availability, availableDates, availableRanges };
}

async function fetchUserBookings() {
  try {
    const response = await apiFetch(`${API}/bookings`, { credentials: "include" });
    if (!response.ok) {
      logger.warn("Failed to fetch user bookings", { status: response.status });
      return [];
    }
    const data = await response.json();
    return Array.isArray(data.bookings) ? data.bookings : [];
  } catch (error) {
    logger.error("Failed to fetch user bookings", error && error.message ? error.message : error);
    return [];
  }
}

export default {
  fetchAllResources,
  fetchTypes,
  fetchAvailability,
  fetchUserBookings,
};
