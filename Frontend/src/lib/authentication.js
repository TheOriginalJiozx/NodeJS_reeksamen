import apiFetch, { clearCsrfCache } from "./api.js";
import notifier from "./notifier.js";
import { setUser, clearUser } from "../store/usersStore.js";
import logger from "./logger.js";

export async function login(credentials) {
  const { username, password } = credentials || {};
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "include",
  });

  let data = {};
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) data = await res.json();
  else data = { message: await res.text() };

  if (res.ok && data.user) {
    setUser(data.user);
    notifier.success("Successfully logged in");
  }

  return { res, data };
}

export async function register(payload) {
  const res = await apiFetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  let data = {};
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) data = await res.json();
  else data = { message: await res.text() };

  if (res.ok) notifier.success(data.message || "Account created");
  else notifier.error(data.message || "Registration failed");

  return { res, data };
}

export async function logout() {
  try {
    const res = await apiFetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clearUser();
    try {
      clearCsrfCache();
    } catch (error) {
        logger.error("Error clearing CSRF cache on logout", error && error.message ? error.message : error);
    }
    return res;
  } catch (error) {
    clearUser();
    throw error;
  }
}

const authentication = { login, register, logout };
export default authentication;
