import { writable } from "svelte/store";
import logger from "../lib/logger.js";
import { apiFetch } from "../lib/api.js";

const authUser = writable(null);
const userMessage = writable("");
const ready = writable(false);

let bootstrapped = false;
let bootstrapPromise = null;

async function bootstrap() {
  if (bootstrapped) return bootstrapPromise;
  bootstrapped = true;

  bootstrapPromise = (async () => {
    try {
      try {
        const cached = localStorage.getItem("user");
        if (cached) {
          try {
            authUser.set(JSON.parse(cached));
          } catch (error) { logger.warn("Could not parse cached user JSON, using raw value", error && error.message ? error.message : error);
            authUser.set(cached);
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
          authUser.set(null);
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
          authUser.set(data.user || null);
          try {
            localStorage.setItem("user", JSON.stringify(data.user || null));
          } catch (error) {
            logger.warn("Could not access localStorage to save user", error && error.message ? error.message : error);
          }
          userMessage.set("");
          return;
        }

        authUser.set(null);
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

function setUser(username) {
  authUser.set(username);
  try {
    localStorage.setItem("user", JSON.stringify(username));
  } catch (error) {
    logger.warn("Could not access localStorage to save user", error && error.message ? error.message : error);
  }
  userMessage.set("");
}

function clearUser() {
  authUser.set(null);
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

export { authUser, userMessage, ready, bootstrap, setUser, clearUser };
