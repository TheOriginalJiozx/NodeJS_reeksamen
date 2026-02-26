<script>
  import { onMount } from "svelte";
  import { authUser } from "../store/usersStore.js";
  import { navigate, route } from "../lib/router.js";
  import notifier from "../lib/notifier.js";
  import logger from "../lib/logger.js";
  import { apiFetch } from "../lib/api.js";
  import { setAuth } from "../lib/authentication.js";
  import responseUtils from "../utils/responseUtils.js";

  let username = "";
  let password = "";

  onMount(() => {
    if ($authUser) {
      navigate("/profile");
      route.set("/profile");
    }
  });

  async function submit(event) {
    event.preventDefault();

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await responseUtils.parseResponse(res);

      if (!res.ok) {
        const errorMessage = responseUtils.getErrorMessage(data, "Login failed");
        notifier.error(errorMessage);
        return;
      }

      const successMsg = responseUtils.getSuccessMessage(data, "Login successful");
      notifier.success(successMsg);
      if (data.user) setAuth(data.user);
      username = "";
      password = "";
      navigate("/profile");
      route.set("/profile");
    } catch (error) {
      const errorMessage = error && error.message ? error.message : "Network error";
      notifier.error(errorMessage);
      logger.error("Login error", errorMessage);
    }
  }
</script>

<div class="container mx-auto px-4">
  <div class="bg-gray-100 rounded-2xl shadow-xl overflow-hidden">
    <div class="p-8 md:p-12">
      <section class="max-w-md mx-auto mt-3 bg-white rounded shadow p-6">
        <h2 class="text-2xl font-semibold mb-4">Log in</h2>
        <form on:submit={submit} class="space-y-4">
          <div>
            <label for="login-username" class="block text-sm mb-1">Username</label>
            <input id="login-username" type="text" class="w-full border rounded px-3 py-2" bind:value={username} />
          </div>
          <div>
            <label for="login-password" class="block text-sm mb-1">Password</label>
            <input id="login-password" type="password" class="w-full border rounded px-3 py-2" bind:value={password} />
          </div>
          <div>
            <button class="bg-green-600 text-white px-4 py-2 rounded">Log in</button>
          </div>
        </form>
      </section>
    </div>
  </div>
</div>
