import { apiFetch } from "../lib/api.js";
import { removeNotificationsByBookingId } from "../store/notificationsStore.js";
import notifier from "../lib/notifier.js";
import fetchers from "../fetchers/bookingFetchers.js";
import logger from "../lib/logger.js";

async function fetchBookingsFor(resourceId) {
  try {
    const res = await apiFetch(`/api/bookings?resourceId=${resourceId}`, { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.bookings) ? data.bookings : data.bookings || [];
  } catch (error) {
    logger.error("Failed to fetch bookings for resource", error && error.message ? error.message : error);
    return [];
  }
}

async function loadResourcesWithBookingsAndAvailability(userId) {
  try {
    if (!userId) return { resources: [], resourceBookings: {}, resourceAvailabilities: {} };
    const res = await apiFetch(`/api/users/${userId}/resources`);
    if (!res.ok) return { resources: [], resourceBookings: {}, resourceAvailabilities: {} };
    const resources = await res.json();
    const bookingsList = await Promise.all(resources.map((resource) => fetchBookingsFor(resource.id)));
    const availableList = await Promise.all(resources.map((resource) => fetchers.fetchAvailability(resource.id)));
    const resourceBookings = {};
    const resourceAvailabilities = {};
    resources.forEach((resource, index) => {
      resourceBookings[String(resource.id)] = bookingsList[index] || [];
      resourceAvailabilities[String(resource.id)] = (availableList[index] && availableList[index].availability) || [];
    });
    return { resources, resourceBookings, resourceAvailabilities };
  } catch (error) {
    logger.error("Failed to load resources", error && error.message ? error.message : error);
    return { resources: [], resourceBookings: {}, resourceAvailabilities: {} };
  }
}

async function confirmBooking(bookingId) {
  const res = await apiFetch(`/api/bookings/${bookingId}/confirm`, { method: "PATCH" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.message || "Failed to confirm booking");
    return false;
  }
  removeNotificationsByBookingId(bookingId);
  notifier?.success?.("Booking confirmed");
  return true;
}

async function declineBooking(bookingId) {
  if (!confirm("Decline this booking request?")) return false;
  const res = await apiFetch(`/api/bookings/${bookingId}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.message || "Failed to decline booking");
    return false;
  }
  removeNotificationsByBookingId(bookingId);
  notifier?.success?.("Booking declined");
  return true;
}

async function deleteResource(id) {
  if (!confirm("Delete this resource? This cannot be undone.")) return { ok: false };
  const res = await apiFetch(`/api/resources/${id}`, { method: "DELETE" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: json.message || "Failed to delete resource" };
  }
  return { ok: true };
}

async function deleteAvailability(resourceId, availabilityId) {
  if (!resourceId || !availabilityId) {
    notifier.error("Invalid resource or availability ID");
    return false;
  }

  if (!confirm("Delete this availability?")) return false;

  const response = await apiFetch(`/api/resources/${resourceId}/availabilities/${availabilityId}`, {
    method: "DELETE",
  });

  let data = {};
  const content = response.headers.get("content-type");
  if (content.includes("application/json")) data = await response.json();
  else data = { message: await response.text() };

  if (!response.ok) {
    notifier.error(data.message || "Failed to delete availability");
    return false;
  }

  notifier.success(data.message || "Availability deleted");
  return true;
}

export default {
  fetchBookingsFor,
  loadResourcesWithBookingsAndAvailability,
  confirmBooking,
  declineBooking,
  deleteResource,
  deleteAvailability,
};
