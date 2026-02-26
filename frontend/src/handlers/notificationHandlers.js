import resourceHandlers from "./resourceHandlers.js";
import fetchers from "../fetchers/bookingFetchers.js";
import { pushNotification } from "../store/notificationsStore.js";
import logger from "../lib/logger.js";

async function loadExistingNotifications(userId) {
  try {
    const { resources, resourceBookings } = await resourceHandlers.loadResourcesWithBookingsAndAvailability(userId);
    const allNotifications = [];

    resources.forEach((resource) => {
      const bookings = resourceBookings[String(resource.id)] || [];
      bookings.forEach((booking) => {
        if (!booking.confirmed) {
          allNotifications.push({
            type: "booking",
            navTo: "/myresources",
            bookingId: booking.id,
            resourceId: resource.id,
            resourceName: resource.name,
            bookingDate: booking.bookingDate,
            bookingEndDate: booking.bookingEndDate,
          });
        }
      });
    });

    const userBookings = await fetchers.fetchUserBookings();
    userBookings.forEach((booking) => {
      if (booking.confirmed === true) {
        allNotifications.push({
          type: "booking:confirmed",
          navTo: "/mybookings",
          bookingId: booking.id,
          resourceId: booking.resourceId,
          resourceName: booking.resourceName,
          bookingDate: booking.bookingDate,
          bookingEndDate: booking.bookingEndDate,
        });
      } else if (booking.confirmed === 2) {
        allNotifications.push({
          type: "booking:declined",
          navTo: "/mybookings",
          bookingId: booking.id,
          resourceId: booking.resourceId,
          resourceName: booking.resourceName,
          bookingDate: booking.bookingDate,
          bookingEndDate: booking.bookingEndDate,
        });
      }
    });

    allNotifications.forEach((notification) => pushNotification(notification));
  } catch (error) {
    logger.error("Failed to load existing notifications on login", error && error.message ? error.message : error);
  }
}

export default {
  loadExistingNotifications,
};
