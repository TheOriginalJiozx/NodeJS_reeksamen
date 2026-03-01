import { writable } from "svelte/store";
import logger from "./logger.js";
import { apiFetch } from "./api.js";

const authUser = writable(null);
const userMessage = writable("");
const ready = writable(false);

const protectedRoutes = new Set(["/profile", "/booking", "/mybookings", "/myresources", "/book", "/create"]);

let bootstrapped = false;
let bootstrapPromise = null;

function getCachedUser() {
  try {
    const cached = localStorage.getItem("user");
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (error) {
    logger.error("Failed to parse cached user", error?.message || error);
    localStorage.removeItem("user");
    return null;
  }
}

function isValidUser(user) {
  return !!user?.id;
}

function clearUserCache() {
  try {
    localStorage.removeItem("user");
  } catch (error) {
    logger.debug("Failed to clear user cache", error?.message || error);
  }
}

function saveUserToCache(user) {
  try {
    localStorage.setItem("user", JSON.stringify(user));
  } catch (error) {
    logger.warn("Could not access localStorage to save user", error?.message || error);
  }
}

async function bootstrap() {
  if (bootstrapped) return bootstrapPromise;
  bootstrapped = true;

  bootstrapPromise = (async () => {
    try {
      const cached = getCachedUser();
      if (cached) {
        authUser.set(cached);
      }

      const parsed = getCachedUser();
      if (!isValidUser(parsed)) {
        authUser.set(null);
        userMessage.set("Not authenticated");
        clearUserCache();
        return;
      }

      const fetchUrl = `/api/users/${parsed.id}`;
      const res = await apiFetch(fetchUrl, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        authUser.set(data.user || null);
        saveUserToCache(data.user || null);
        userMessage.set("");
        return;
      }

      authUser.set(null);
      clearUserCache();
      userMessage.set("Not authenticated");
    } catch (error) {
      logger.error("Failed to fetch /api/users/:id for bootstrap", error?.message || error);
      userMessage.set("Could not fetch user");
    } finally {
      ready.set(true);
    }
  })();

  return bootstrapPromise;
}

function setUserSessionAuth(username) {
  authUser.set(username);
  saveUserToCache(username);
  userMessage.set("");
}

function clearUserSessionAuth() {
  authUser.set(null);
  clearUserCache();
  userMessage.set("");
}

function isAdmin(user) {
  return !!(user && user.role === "admin");
}

function loadAuthenticatedUser() {
  const user = getCachedUser();
  if (!isValidUser(user)) {
    clearUserCache();
    return null;
  }
  return user;
}

if (typeof window !== "undefined") {
  bootstrap();
}

export { authUser, ready, bootstrap, setUserSessionAuth, clearUserSessionAuth, protectedRoutes, isAdmin, getCachedUser, loadAuthenticatedUser, clearUserCache };
