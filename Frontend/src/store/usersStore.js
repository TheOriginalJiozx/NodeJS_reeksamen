import { writable } from "svelte/store";
import logger from "../lib/logger.js";
import apiFetch from "../lib/api.js";

const user = writable(null);
const userMessage = writable("");
const ready = writable(false);

let bootstrapped = false;
let bootstrapPromise = null;

export async function bootstrap() {
  if (bootstrapped) return bootstrapPromise;
  bootstrapped = true;

  bootstrapPromise = (async () => {
    try {
      try {
        const cached = localStorage.getItem("user");
        if (cached) {
          try {
            user.set(JSON.parse(cached));
          } catch (error) { logger.warn("Could not parse cached user JSON, using raw value", error && error.message ? error.message : error);
            user.set(cached);
          }
        }
      } catch (error) {
        logger.warn("Could not access localStorage for user bootstrap", error && error.message ? error.message : error);
      }

      try {
        const cachedRaw = localStorage.getItem("user");
        let parsed = null;
        try {
          parsed = cachedRaw ? JSON.parse(cachedRaw) : null;
        } catch {
          parsed = null;
        }

        if (!parsed || !parsed.id) {
          user.set(null);
          userMessage.set("Not authenticated");
          try {
            localStorage.removeItem("user");
          } catch (error) {
            logger.warn("Could not remove invalid cached user", error && error.message ? error.message : error);
          }
          return;
        }

        const fetchUrl = `/api/users/${parsed.id}`;
        const res = await apiFetch(fetchUrl, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          user.set(data.user || null);
          try {
            localStorage.setItem("user", JSON.stringify(data.user || null));
          } catch (error) {
            logger.warn("Could not access localStorage to save user", error && error.message ? error.message : error);
          }
          userMessage.set("");
          return;
        }

        user.set(null);
        try {
          localStorage.removeItem("user");
        } catch (error) {
          logger.warn("Could not remove cached user", error && error.message ? error.message : error);
        }
        userMessage.set("Not authenticated");
      } catch (error) {
        logger.error("Failed to fetch /api/users/:id for bootstrap", error && error.message ? error.message : error);
        userMessage.set("Could not fetch user");
      }
    } finally {
      ready.set(true);
    }
  })();

  return bootstrapPromise;
}

export function setUser(username) {
  user.set(username);
  try {
    localStorage.setItem("user", JSON.stringify(username));
  } catch (error) {
    logger.warn("Could not access localStorage to save user", error && error.message ? error.message : error);
  }
  userMessage.set("");
}

export function clearUser() {
  user.set(null);
  try {
    localStorage.removeItem("user");
  } catch (error) {
    logger.warn("Could not remove cached user from localStorage", error && error.message ? error.message : error);
  }
  userMessage.set("");
}

if (typeof window !== "undefined") {
  bootstrap();
}

export { userMessage, ready };
export default user;
