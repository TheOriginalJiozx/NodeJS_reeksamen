import { fetchUserBookings } from "../fetchers/bookingFetchers.js";
import { loadResourcesWithBookingsAndAvailability } from "./resourceHandlers.js";
import { pushNotification } from "../store/notificationsStore.js";
import logger from "../lib/logger.js";

async function loadExistingNotifications(userId) {
  try {
    const { resources, resourceBookings } = await loadResourcesWithBookingsAndAvailability(userId);
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
        
        if (booking.defect_reported) {
          allNotifications.push({
            type: "defect:reported",
            navTo: "/myresources",
            bookingId: booking.id,
            resourceId: resource.id,
            resourceName: resource.name,
            booker: booking.booker,
            defectReport: booking.defect_reported,
            defectImage: booking.defect_image,
            message: `Defect reported on ${resource.name} by ${booking.booker}`
          });
        }
      });
    });

    const userBookings = await fetchUserBookings();
    userBookings.forEach((booking) => {
      if (booking.confirmed === 1) {
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
    logger.error("Failed to load existing notifications on login", error?.message || error);
  }
}

export { loadExistingNotifications };
