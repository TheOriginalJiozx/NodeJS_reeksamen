import { writable, derived } from 'svelte/store';

const notifications = writable([]);
const defectedBookingCount = writable(null);
const unseenBookingsCount = writable(0);

function pushNotification(notification) {
  notifications.update((array) => {
    if (notification.bookingId) {
      const exists = array.some((existingNotification) => String(existingNotification.bookingId) === String(notification.bookingId));
      if (exists) return array;
    }
    return [notification, ...array];
  });
}

function clearNotifications() {
  notifications.set([]);
}

function removeNotificationsByBookingId(bookingId) {
  if (!bookingId) return;
  notifications.update((array) => array.filter((notification) => String(notification.bookingId) !== String(bookingId)));
}

const resourceBookingNotifications = derived(notifications, (allNotifications) => 
  allNotifications.filter((notification) => notification.type === "booking")
);

const myBookingNotifications = derived(notifications, (allNotifications) => 
  allNotifications.filter((notification) => notification.type === "booking:confirmed" || notification.type === "booking:declined")
);

const defectReportedNotifications = derived(notifications, (allNotifications) => 
  allNotifications.filter((notification) => notification.type === "defect:reported")
);

const resourceBookingCount = {
  subscribe: (run) => resourceBookingNotifications.subscribe((array) => run(array.length)),
};

const defectReportedCount = {
  subscribe: (run) => defectReportedNotifications.subscribe((array) => run(array.length)),
};

export { notifications, pushNotification, clearNotifications, removeNotificationsByBookingId, resourceBookingCount, defectReportedCount, defectedBookingCount, unseenBookingsCount };
