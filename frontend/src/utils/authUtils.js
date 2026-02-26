import logger from "../lib/logger.js";

function getCachedUser() {
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

function isValidUser(user) {
  return user && user.id ? true : false;
}

function loadAuthenticatedUser() {
  const user = getCachedUser();
  if (!isValidUser(user)) {
    localStorage.removeItem("user");
    return null;
  }
  return user;
}

function clearUserCache() {
  try {
    localStorage.removeItem("user");
  } catch (error) {
    logger.debug("Failed to clear user cache", error && error.message ? error.message : error);
  }
}

export default {
  getCachedUser,
  isValidUser,
  loadAuthenticatedUser,
  clearUserCache,
};
