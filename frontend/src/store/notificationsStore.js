import { writable, derived } from 'svelte/store';

export const notifications = writable([]);

export function pushNotification(notification) {
  notifications.update((array) => {
    if (notification.bookingId) {
      const exists = array.some((existingNotification) => String(existingNotification.bookingId) === String(notification.bookingId));
      if (exists) return array;
    }
    return [notification, ...array];
  });
}

export function clearNotifications() {
  notifications.set([]);
}

export function removeNotificationsByBookingId(bookingId) {
  if (!bookingId) return;
  notifications.update((array) => array.filter((notification) => String(notification.bookingId) !== String(bookingId)));
}

export const notificationCount = {
  subscribe: (run) => notifications.subscribe((array) => run(array.length)),
};

export const resourceBookingNotifications = derived(notifications, (allNotifications) => 
  allNotifications.filter((notification) => notification.type === "booking")
);

export const myBookingNotifications = derived(notifications, (allNotifications) => 
  allNotifications.filter((notification) => notification.type === "booking:confirmed" || notification.type === "booking:declined")
);

export const resourceBookingCount = {
  subscribe: (run) => resourceBookingNotifications.subscribe((array) => run(array.length)),
};

export const myBookingCount = {
  subscribe: (run) => myBookingNotifications.subscribe((array) => run(array.length)),
};

export default notifications;
