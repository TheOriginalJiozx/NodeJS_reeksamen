import { writable } from 'svelte/store';

export const notifications = writable([]);

export function pushNotification(notification) {
  notifications.update((array) => [notification, ...array]);
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

export default notifications;
