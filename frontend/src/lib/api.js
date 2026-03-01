import logger from "./logger";
import notifier from "./notifier";

let cachedCsrf = null;

async function apiFetch(input, options = {}) {
  try {
    const requestOptions = Object.assign({ credentials: "include" }, options || {});
    const method = (requestOptions.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      const token = await fetchCsrf();
      if (token) {
        requestOptions.headers = Object.assign({}, requestOptions.headers || {}, {
          "x-csrf-token": token,
        });
      }
    }
    
    const response = await fetch(input, requestOptions);
    
    if (response.status === 403 && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      logger.warn("CSRF token invalid, clearing cache and retrying");
      clearCsrfCache();
      const newToken = await fetchCsrf();
      if (newToken) {
        requestOptions.headers = Object.assign({}, requestOptions.headers || {}, {
          "x-csrf-token": newToken,
        });
        return fetch(input, requestOptions);
      }
    }
    
    return response;
  } catch (error) {
    logger.error("apiFetch network error", error?.message || error);
    notifier.error("Network error: " + (error.message || error));
    throw error;
  }
}

async function fetchCsrf() {
  if (cachedCsrf) return cachedCsrf;
  try {
    const res = await fetch("/api/csrf-token", { credentials: "include" });
    if (!res.ok) {
      logger.warn("Failed to fetch CSRF token", { status: res.status });
      return null;
    }
    const json = await res.json();
    cachedCsrf = json?.csrfToken ?? null;
    return cachedCsrf;
  } catch (error) {
    logger.error("CSRF token fetch error", error?.message || error);
    notifier.error("Failed to fetch CSRF token: " + error.message);
    return null;
  }
}

function clearCsrfCache() {
  cachedCsrf = null;
}

export { apiFetch, clearCsrfCache };
