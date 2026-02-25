<script>
  import { onMount } from "svelte";
  import { navigate } from "../lib/router.js";
  import notifier from "../lib/notifier.js";
  import { clearAuth } from "../lib/authentication.js";
  import authUser from "../store/usersStore.js";
  import { isAdmin } from "../lib/authorization.js";
  import logger from "../lib/logger.js";
  import apiFetch from "../lib/api.js";
  import { loadAuthenticatedUser, clearUserCache } from "../utils/authUtils.js";
  import { parseResponse, getErrorMessage, getSuccessMessage } from "../utils/responseUtils.js";

  let user = null;
  let loading = true;
  let deleting = false;
  let exporting = false;

  async function deleteAccount() {
    if (!confirm("Are you sure you want to delete your account? This will remove your resources and related data.")) return;
    deleting = true;
    try {
      const targetId = user && user.id ? user.id : null;
      if (!targetId) {
        notifier.error("Invalid user");
        deleting = false;
        return;
      }

      const res = await apiFetch(`/api/users/${targetId}`, { method: "DELETE" });
      const data = await parseResponse(res);

      if (res.ok) {
        clearUserCache();
        try {
          clearAuth();
        } catch (error) {}
        notifier.success(getSuccessMessage(data, "Account deleted"));
        navigate("/");
        return;
      }

      const errorMessage = getErrorMessage(data, "Failed to delete account");
      notifier.error(errorMessage);
    } catch (error) {
      notifier.error("Failed to delete account");
      logger.error("Delete account error", error && error.message ? error.message : error);
    } finally {
      deleting = false;
    }
  }

  async function exportData() {
    if (!confirm("Export your data to a JSON file?")) return;
    exporting = true;
    try {
      const res = await apiFetch("/api/users/export", { method: "GET" });
      if (!res.ok) {
        const error = await parseResponse(res);
        notifier.error(getErrorMessage(error, "Export failed"));
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const username = user?.username || "user";
      let filename = `${username}-data.json`;
      const match = /filename=\"?([^\";]+)\"?/.exec(disposition);
      if (match && match[1]) filename = match[1];

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      notifier.success("Export complete");
    } catch (error) {
      logger.error("Export error", error && error.message ? error.message : error);
      notifier.error("Export failed");
    } finally {
      exporting = false;
    }
  }

  onMount(async () => {
    try {
      const parsed = loadAuthenticatedUser();
      if (!parsed) {
        navigate("/login");
        return;
      }

      const res = await apiFetch(`/api/users/${parsed.id}`, { credentials: "include" });
      if (res.status === 401) {
        notifier.error("Session expired. Please log in again.");
        navigate("/login");
        return;
      }

      if (!res.ok) {
        notifier.error("Failed to load profile");
        logger.error("Failed to fetch user profile", `Status: ${res.status}`);
        return;
      }

      const data = await parseResponse(res);
      user = data.user || null;
    } catch (error) {
      notifier.error("Failed to load profile");
      logger.error("Profile fetch error", error && error.message ? error.message : error);
    } finally {
      loading = false;
    }
  });
</script>

<div class="container mx-auto px-4">
  <div class="bg-gray-100 rounded-2xl shadow-xl overflow-hidden">
    <div class="py-4 md:py-12 px-6">
      <section class="max-w-lg mx-auto mt-6 bg-white rounded shadow p-6">
        <h2 class="text-2xl font-semibold mb-4">Profile</h2>

        {#if loading}
          <div class="text-gray-600">Loading...</div>
        {:else if user}
          <div class="space-y-2">
            <div><strong>Full Name:</strong> {user.fullname}</div>
            <div><strong>Username:</strong> {user.username}</div>
            <div><strong>Email:</strong> {user.email}</div>
            <div class="flex items-center">
              <div><strong>Role:</strong> {user.role}</div>
              {#if isAdmin($authUser)}
                <div class="ml-3 text-sm bg-yellow-200 text-yellow-800 px-2 py-1 rounded">Admin</div>
              {/if}
            </div>
            <button class="bg-red-600 text-white px-3 py-1 rounded" on:click|preventDefault={deleteAccount} disabled={deleting}>
              {#if deleting}Deleting...{:else}Delete account{/if}
            </button>
            <button class="bg-green-600 text-white px-3 py-1 rounded" on:click|preventDefault={exportData} disabled={exporting}>
              {#if exporting}Exporting...{:else}Export{/if}
            </button>
          </div>
        {:else}
          <div class="text-gray-600">Unable to load profile</div>
        {/if}
      </section>
    </div>
  </div>
</div>
