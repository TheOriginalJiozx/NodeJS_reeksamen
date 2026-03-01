import { apiFetch } from "../lib/api.js";
import notifier from "../lib/notifier.js";
import logger from "../lib/logger.js";

async function fetchUserBookings(userId) {
  try {
    const res = await apiFetch(`/api/users/${userId}`, { credentials: "include" });
    if (res.status === 401) {
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      notifier.error("Failed to load user profile");
      return null;
    }
    return await res.json();
  } catch (error) {
    logger.error("Error fetching user", error?.message || error);
    return null;
  }
}

async function fetchAllBookings(userFullname) {
  try {
    const res = await apiFetch("/api/bookings", { credentials: "include" });
    if (!res.ok) {
      notifier.error("Failed to load bookings");
      return [];
    }
    const data = await res.json();
    let bookings = Array.isArray(data.bookings) ? data.bookings : data.bookings || [];
    if (userFullname) {
      bookings = bookings.filter((booking) => String(booking.booker) === String(userFullname));
    }
    bookings.sort((left, right) => new Date(left.startDate) - new Date(right.startDate));
    return bookings;
  } catch (error) {
    notifier.error("Failed to load bookings");
    logger.error("Error fetching bookings", error?.message || error);
    return [];
  }
}

async function fetchAllResources() {
  try {
    const res = await apiFetch("/api/resources", { credentials: "include" });
    if (!res.ok) {
      notifier.error("Failed to load resources");
      return { resources: [], resourceMap: {} };
    }
    const resources = await res.json();
    const resourceMap = {};
    for (const resource of resources) {
      resourceMap[String(resource.id)] = resource;
    }
    return { resources, resourceMap };
  } catch (error) {
    notifier.error("Failed to load resources");
    logger.error("Failed to fetch resources", error?.message || error);
    return { resources: [], resourceMap: {} };
  }
}

export { fetchUserBookings, fetchAllBookings, fetchAllResources };
