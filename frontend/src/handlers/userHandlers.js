import { apiFetch } from "../lib/api.js";
import { handleAuthorizationError } from "../lib/authorization.js";
import notifier from "../lib/notifier.js";

const baseURL = "/api";

async function deleteUserAccount(userId) {
  if (!userId) {
    notifier.error("Invalid user");
    return { ok: false };
  }

  const res = await apiFetch(`${baseURL}/users/${userId}`, { method: "DELETE" });

  const authError = handleAuthorizationError(res);
  if (authError) {
    notifier.error(authError.message);
    return { ok: false };
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    notifier.error(data.message || "Failed to delete account");
    return { ok: false };
  }

  notifier.success(data.message || "Account deleted");
  return { ok: true, data };
}

async function exportUserData() {
  const res = await apiFetch(`${baseURL}/users/export`, { method: "GET" });

  const authError = handleAuthorizationError(res);
  if (authError) {
    notifier.error(authError.message);
    return { ok: false };
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    notifier.error(error.message || "Export failed");
    return { ok: false };
  }

  return { ok: true, response: res };
}

async function updateUsername(userId, newUsername) {
  if (!userId) {
    notifier.error("Invalid user");
    return { ok: false };
  }

  const res = await apiFetch(`${baseURL}/users/${userId}/username`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newUsername }),
  });

  const authError = handleAuthorizationError(res);
  if (authError) {
    notifier.error(authError.message);
    return { ok: false };
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    notifier.error(data.message || "Failed to change username");
    return { ok: false };
  }

  notifier.success(data.message || "Username updated");
  return { ok: true, data };
}

async function updateFullName(userId, newFullName) {
  if (!userId) {
    notifier.error("Invalid user");
    return { ok: false };
  }

  const res = await apiFetch(`${baseURL}/users/${userId}/fullname`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newFullName: newFullName.trim() }),
  });

  const authError = handleAuthorizationError(res);
  if (authError) {
    notifier.error(authError.message);
    return { ok: false };
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    notifier.error(data.message || "Failed to change full name");
    return { ok: false };
  }

  notifier.success(data.message || "Full name updated");
  return { ok: true, data };
}

async function updatePassword(userId, currentPassword, newPassword, confirmNewPassword) {
  if (!userId) {
    notifier.error("Invalid user");
    return { ok: false };
  }

  const res = await apiFetch(`${baseURL}/users/${userId}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
  });

  const authError = handleAuthorizationError(res);
  if (authError) {
    notifier.error(authError.message);
    return { ok: false };
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    notifier.error(data.message || "Failed to update password");
    return { ok: false };
  }

  notifier.success(data.message || "Password updated");
  return { ok: true, data };
}

export { deleteUserAccount, exportUserData, updateUsername, updateFullName, updatePassword };
