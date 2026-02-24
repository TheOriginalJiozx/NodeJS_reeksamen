<script>
  import { onMount } from "svelte";
  import { navigate } from "../lib/router.js";
  import notifier from "../lib/notifier.js";
  import { clearAuth } from "../lib/authentication.js";
  import authUser from "../store/usersStore.js";
  import { isAdmin } from "../lib/authorization.js";
  import logger from "../lib/logger.js";
  import apiFetch from "../lib/api.js";

  let user = null;
  let loading = true;
  let message = "";
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
      const content = res.headers.get("content-type") || "";
      let data = {};
      if (content.includes("application/json")) data = await res.json();
      else data = { message: await res.text() };

      if (res.ok) {
        try {
          localStorage.removeItem("user");
        } catch (error) {
          logger.error("Failed to remove user from localStorage", error && error.message ? error.message : error);
        }
        try {
          clearAuth();
        } catch (error) {}
        notifier.success(data.message || "Account deleted");
        navigate("/");
        return;
      }

      if (res.status === 409) {
        notifier.error(data.message || "Cannot delete account while active bookings exist");
      } else if (res.status === 403) {
        notifier.error(data.message || "You are not allowed to delete this account");
      } else {
        notifier.error(data.message || "Failed to delete account");
      }
    } catch (error) {
      notifier.error("Failed to delete account");
    } finally {
      deleting = false;
    }
  }

  async function exportData() {
    if (!confirm("Export your data to a JSON file?")) return;
    exporting = true;
    try {
      const apiFetch = (await import("../lib/api.js")).default;
      const res = await apiFetch("/api/users/export", { method: "POST" });
      if (!res.ok) {
        let error = {};
        try {
          error = await res.json();
        } catch (error) {
          logger.error("Failed to parse export error response", error && error.message ? error.message : error);
        }
        notifier.error(error.message || "Export failed");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      let filename = "user-data.json";
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
      logger.error(error, "Export failed");
      notifier.error("Export failed");
    } finally {
      exporting = false;
    }
  }

  onMount(async () => {
    try {
      const cached = localStorage.getItem("user");
      let parsed = null;
      try {
        parsed = cached ? JSON.parse(cached) : null;
      } catch (error) {
        parsed = null;
      }
      if (!parsed || !parsed.id) {
        navigate("/login");
        return;
      }

      const res = await apiFetch(`/api/users/${parsed.id}`, { credentials: "include" });
      if (res.status === 401) {
        navigate("/login");
        return;
      }

      let data = {};
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { message: text };
      }

      user = data.user || null;
    } catch (error) {
      message = "Could not load profile.";
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
            <button class="bg-blue-600 text-white px-3 py-1 rounded" on:click={() => navigate("/mybookings")}>My bookings</button>
            <button class="bg-blue-600 text-white px-3 py-1 rounded" on:click={() => navigate("/myresources")}>My resources</button>
            <button class="bg-red-600 text-white px-3 py-1 rounded" on:click|preventDefault={deleteAccount} disabled={deleting}>
              {#if deleting}Deleting...{:else}Delete account{/if}
            </button>
            <button class="bg-green-600 text-white px-3 py-1 rounded" on:click|preventDefault={exportData} disabled={exporting}>
              {#if exporting}Exporting...{:else}Export{/if}
            </button>
          </div>
        {:else}
          <div class="text-red-600">{message}</div>
        {/if}
      </section>
    </div>
  </div>
</div>
