let cachedCsrf = null;

export default async function apiFetch(input, options = {}) {
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
  return fetch(input, requestOptions);
}

async function fetchCsrf() {
  if (cachedCsrf) return cachedCsrf;
  try {
    const res = await fetch("/api/csrf-token", { credentials: "include" });
    if (!res.ok) return null;
    const json = await res.json();
    cachedCsrf = json && json.csrfToken ? json.csrfToken : null;
    return cachedCsrf;
  } catch {
    return null;
  }
}

export function clearCsrfCache() {
  cachedCsrf = null;
}
