<script>
  import { onMount } from "svelte";
  import { apiFetch } from "../lib/api.js";
  import notifier from "../lib/notifier.js";
  import logger from "../lib/logger.js";
  import authUtils from "../utils/authUtils.js";

  let loading = true;
  let currentUser = null;

  let newUsername = "";
  let changingUsername = false;
  let newFullName = "";
  let changingFullName = false;

  let currentPassword = "";
  let newPassword = "";
  let confirmNewPassword = "";
  let changingPassword = false;
  let passwordMessage = "";

  onMount(async () => {
    loading = true;
    try {
      const parsed = authUtils.loadAuthenticatedUser();
      if (!parsed || !parsed.id) {
        currentUser = null;
        return;
      }
      const user = await apiFetch(`/api/users/${parsed.id}`, { credentials: "include" });
      if (!user.ok) {
        currentUser = null;
        return;
      }
      const data = await user.json();
      currentUser = data.user || null;
    } catch (error) {
      logger.error("Settings load error", error && error.message ? error.message : error);
      currentUser = null;
    } finally {
      loading = false;
    }
  });

  async function changeUsername() {
    if (!currentUser || !currentUser.id) return;
    changingUsername = true;
    try {
      const res = await apiFetch(`/api/users/${currentUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUsername }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return notifier.error(data.message || "Failed to change username");
      notifier.success(data.message || "Username updated");
      currentUser.username = newUsername;
      newUsername = "";
    } catch (error) {
      logger.error("Change username error", error && error.message ? error.message : error);
      notifier.error("Network error");
    } finally {
      changingUsername = false;
    }
  }

  async function changeFullName() {
    if (!currentUser || !currentUser.id) return;
    changingFullName = true;
    try {
      const res = await apiFetch(`/api/users/${currentUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newFullName: newFullName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return notifier.error(data.message || "Failed to change full name");
      notifier.success(data.message || "Full name updated");
      currentUser.fullName = newFullName;
      newFullName = "";
    } catch (error) {
      logger.error("Change full name error", error && error.message ? error.message : error);
      notifier.error("Network error");
    } finally {
      changingFullName = false;
    }
  }

  async function changePassword() {
    if (!currentUser || !currentUser.id) return;
    changingPassword = true;
    passwordMessage = "";
    try {
      const res = await apiFetch(`/api/users/${currentUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        passwordMessage = data.message || "Failed to change password";
        return;
      }
      passwordMessage = "Password updated";
      notifier.success(passwordMessage);
      currentPassword = "";
      newPassword = "";
      confirmNewPassword = "";
    } catch (error) {
      logger.error("Change password error", error && error.message ? error.message : error);
      passwordMessage = "Network error";
    } finally {
      changingPassword = false;
    }
  }
</script>

<div class="container mx-auto px-4">
  <div class="bg-gray-100 rounded-2xl shadow-xl overflow-hidden">
    <div class="py-6 md:py-12 px-6">
      <section class="max-w-lg mx-auto mt-6 bg-white rounded shadow p-6">
        <h2 class="text-2xl font-semibold mb-4">Settings</h2>

        {#if loading}
          <div>Loading...</div>
        {:else if !currentUser}
          <div class="text-red-600">Not authenticated</div>
        {:else}
          <div class="space-y-4">
            <div>
              <h3 class="font-semibold">Change username</h3>
              <div class="mt-2 flex gap-2">
                <input class="border px-2 py-1 flex-1" placeholder="New username" bind:value={newUsername} />
                <button class="bg-blue-600 text-white px-3 py-1 rounded" on:click|preventDefault={changeUsername} disabled={changingUsername}>{changingUsername ? "Saving..." : "Change"}</button>
              </div>
            </div>

            <div>
              <h3 class="font-semibold">Correct full name</h3>
              <div class="mt-2 flex gap-2">
                <input class="border px-2 py-1 flex-1" placeholder="Correct full name" bind:value={newFullName} />
                <button class="bg-blue-600 text-white px-3 py-1 rounded" on:click|preventDefault={changeFullName} disabled={changingFullName}>{changingFullName ? "Saving..." : "Change"}</button>
              </div>
            </div>

            <div>
              <h3 class="font-semibold">Change password</h3>
              <div class="mt-2 space-y-2">
                <input type="password" class="w-full border px-2 py-1" placeholder="Current password" bind:value={currentPassword} />
                <input type="password" class="w-full border px-2 py-1" placeholder="New password" bind:value={newPassword} />
                <input type="password" class="w-full border px-2 py-1" placeholder="Confirm new password" bind:value={confirmNewPassword} />
                <div class="flex items-center gap-2">
                  <button class="bg-blue-600 text-white px-3 py-1 rounded" on:click|preventDefault={changePassword} disabled={changingPassword}>{changingPassword ? "Saving..." : "Change password"}</button>
                  {#if passwordMessage}<div class="text-sm text-gray-600">{passwordMessage}</div>{/if}
                </div>
              </div>
            </div>
          </div>
        {/if}
      </section>
    </div>
  </div>
</div>
