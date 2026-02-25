import logger from "../lib/logger.js";

export function getCachedUser() {
  try {
    const cached = localStorage.getItem("user");
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (error) {
    logger.error("Failed to parse cached user", error && error.message ? error.message : error);
    localStorage.removeItem("user");
    return null;
  }
}

export function isValidUser(user) {
  return user && user.id ? true : false;
}

export function loadAuthenticatedUser() {
  const user = getCachedUser();
  if (!isValidUser(user)) {
    localStorage.removeItem("user");
    return null;
  }
  return user;
}

export function clearUserCache() {
  try {
    localStorage.removeItem("user");
  } catch (error) {
    logger.debug("Failed to clear user cache", error && error.message ? error.message : error);
  }
}
