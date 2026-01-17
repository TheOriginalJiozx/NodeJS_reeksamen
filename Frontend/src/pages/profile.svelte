<script>
  import { onMount } from "svelte";
  import { navigate } from "../lib/router.js";
  import { toast } from "../store/toastStore.js";
  import { clearUser } from "../store/userStore.js";
  import logger from "../lib/logger.js";

  let user = null;
  let loading = true;
  let message = "";
  let deleting = false;
  let exporting = false;

  async function deleteAccount() {
    if (
      !confirm(
        "Are you sure you want to delete your account? This will remove your resources and related data.",
      )
    )
      return;
    deleting = true;
    try {
      const targetId = user && user.id ? user.id : null;
      if (!targetId) {
        toast("Invalid user", "error");
        deleting = false;
        return;
      }
      const res = await fetch(`/api/users/${targetId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const content = res.headers.get("content-type") || "";
      let data = {};
      if (content.includes("application/json")) data = await res.json();
      else data = { message: await res.text() };

      if (res.ok) {
        try {
          localStorage.removeItem("user");
        } catch (error) {
          logger.error(
            "Failed to remove user from localStorage",
            error && error.message ? error.message : error,
          );
        }
        try {
          clearUser();
        } catch (error) {}
        toast(data.message || "Account deleted", "success");
        navigate("/");
        return;
      }

      if (res.status === 409) {
        toast(
          data.message || "Cannot delete account while active bookings exist",
          "error",
        );
      } else {
        toast(data.message || "Failed to delete account", "error");
      }
    } catch (error) {
      toast("Failed to delete account", "error");
    } finally {
      deleting = false;
    }
  }

  async function exportData() {
    if (!confirm("Export your data to a JSON file?")) return;
    exporting = true;
    try {
      const res = await fetch("/api/users/export", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        let error = {};
        try {
          error = await res.json();
        } catch (error) {
            logger.error("Failed to parse export error response", error && error.message ? error.message : error);
        }
        toast(error.message || "Export failed", "error");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      let filename = "user-data.json";
      const match = /filename=\"?([^\";]+)\"?/.exec(disposition);
      if (match && match[1]) filename = match[1];

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Export complete", "success");
    } catch (error) {
      logger.error(error, "Export failed");
      toast("Export failed", "error");
    } finally {
      exporting = false;
    }
  }

  onMount(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
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

<section class="max-w-lg mx-auto mt-12 bg-white rounded shadow p-6">
  <h2 class="text-2xl font-semibold mb-4">Profile</h2>

  {#if loading}
    <div class="text-gray-600">Loading...</div>
  {:else if user}
    <div class="space-y-2">
      <div><strong>Username:</strong> {user.username}</div>
      <div><strong>Email:</strong> {user.email}</div>
      <div><strong>Role:</strong> {user.role}</div>
      <button
        class="bg-blue-600 text-white px-3 py-1 rounded"
        on:click={() => navigate("/mybookings")}>My bookings</button
      >
      <button
        class="bg-blue-600 text-white px-3 py-1 rounded"
        on:click={() => navigate("/myresources")}>My resources</button
      >
      <button
        class="bg-red-600 text-white px-3 py-1 rounded ml-2"
        on:click|preventDefault={deleteAccount}
        disabled={deleting}
      >
        {#if deleting}Deleting...{:else}Delete account{/if}
      </button>
      <button
        class="bg-green-600 text-white px-3 py-1 rounded ml-2"
        on:click|preventDefault={exportData}
        disabled={exporting}
      >
        {#if exporting}Exporting...{:else}Export{/if}
      </button>
    </div>
  {:else}
    <div class="text-red-600">{message}</div>
  {/if}
</section>
