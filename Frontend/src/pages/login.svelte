<script>
  import { onMount } from "svelte";
  import user from "../store/usersStore.js";
  import { navigate, route } from "../lib/router.js";
  import notifier from "../lib/notifier.js";
  import { login } from "../lib/authentication.js";

  let username = "";
  let password = "";
  let message = "";

  onMount(() => {
    if ($user) {
      navigate("/profile");
      route.set("/profile");
    }
  });

  async function submit(event) {
    event.preventDefault();
    if (!username || !password) {
      message = "Please enter username and password.";
      return;
    }

    message = "Logging in...";

    try {
      const { res, data } = await login({ username, password });
      if (!res.ok) {
        message = data && data.message ? data.message : "Login failed";
        return;
      }
      message = data.message || "Login successful";
      username = "";
      password = "";
      navigate("/profile");
      route.set("/profile");
    } catch (error) {
      message = "Network error. Please try again.";
      notifier.error(error && error.message ? error.message : "Network error");
    }
  }
</script>

<div class="container mx-auto px-4">
  <div class="bg-gray-100 rounded-2xl shadow-xl overflow-hidden">
    <div class="p-8 md:p-12">
      <section class="max-w-md mx-auto mt-3 bg-white rounded shadow p-6">
        <h2 class="text-2xl font-semibold mb-4">Log in</h2>
        {#if message}
          <div class="mb-4 text-sm text-green-700">{message}</div>
        {/if}
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
