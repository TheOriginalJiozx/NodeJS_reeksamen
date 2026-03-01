import { apiFetch, clearCsrfCache } from "../lib/api.js";
import { clearUserSessionAuth } from "../lib/auth.js";
import { clearNotifications, defectedBookingCount } from "../store/notificationsStore.js";
import notifier from "../lib/notifier.js";
import logger from "../lib/logger.js";

async function handleLogout(navSocket) {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch (error) {
    notifier.error(error?.message || "Network error");
  }

  try {
    clearUserSessionAuth();
  } catch (error) {
    logger.error("Error clearing user session auth on logout", error?.message || error);
    notifier.error("Error clearing session, please refresh the page");
  }

  try {
    clearCsrfCache();
  } catch (error) {
    logger.error("Error clearing CSRF cache on logout", error?.message || error);
    notifier.error("Error clearing session, please refresh the page");
  }

  if (navSocket && typeof navSocket.disconnect === "function") {
    try {
      navSocket.disconnect();
    } catch (error) {
      logger.warn("Failed to disconnect nav socket on logout", error?.message || error);
      notifier.error("Error disconnecting from notifications, please refresh the page");
    }
  }
}

export { handleLogout };
