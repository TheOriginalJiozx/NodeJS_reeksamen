import { get } from "svelte/store";
import { authUser, setUser, clearUser, bootstrap } from "../store/usersStore.js";
import logger from "./logger.js";

function setAuth(userObject) {
  setUser(userObject);
}

function clearAuth() {
  clearUser();
}

function getAuth() {
  return get(authUser);
}

function subscribeAuth(callback) {
  return authUser.subscribe(callback);
}

async function ensureBootstrap() {
  try {
    await bootstrap();
  } catch (error) {
    logger.error("Authentication bootstrap error",
      error && error.message ? error.message : error,
    );
  }
  return get(authUser);
}

export { setAuth, clearAuth, getAuth, subscribeAuth, ensureBootstrap };
