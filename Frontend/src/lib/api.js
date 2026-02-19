let cachedCsrf = null;
async function fetchCsrf() {
  if (cachedCsrf) return cachedCsrf;
  try {
    const res = await fetch("/api/csrf-token", {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = await res.json();
    cachedCsrf = json && json.csrfToken ? json.csrfToken : null;
    return cachedCsrf;
  } catch (error) {
    return null;
  }
}

export default async function apiFetch(input, options = {}) {
  const options = Object.assign({ credentials: "include" }, options || {});
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const token = await fetchCsrf();
    if (token) {
      options.headers = Object.assign({}, options.headers || {}, {
        "x-csrf-token": token,
      });
    }
  }
  return fetch(input, options);
}

export function clearCsrfCache() {
  cachedCsrf = null;
}
