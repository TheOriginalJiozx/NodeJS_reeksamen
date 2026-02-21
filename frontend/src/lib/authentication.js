import { get } from "svelte/store";
import user, { setUser, clearUser, bootstrap } from "../store/usersStore.js";
import logger from "./logger.js";

export function setAuth(userObject) {
  setUser(userObject);
}

export function clearAuth() {
  clearUser();
}

export function getAuth() {
  return get(user);
}

export function subscribeAuth(callback) {
  return user.subscribe(callback);
}

export async function ensureBootstrap() {
  try {
    await bootstrap();
  } catch (error) {
    logger.error("Authentication bootstrap error",
      error && error.message ? error.message : error,
    );
  }
  return get(user);
}

const authentication = { setAuth, clearAuth, getAuth, subscribeAuth, ensureBootstrap };
export default authentication;
