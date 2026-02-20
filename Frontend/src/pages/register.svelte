<script>
  import notifier from "../lib/notifier.js";
  import { onMount } from "svelte";
  import user from "../store/usersStore.js";
  import { navigate, route } from "../lib/router.js";
  import { register } from "../lib/authentication.js";

  let name = "";
  let email = "";
  let password = "";
  let confirm = "";
  let message = "";

  onMount(() => {
    if ($user) {
      navigate("/profile");
      route.set("/profile");
    }
  });

  async function submit(event) {
    event.preventDefault();
    if (!name || !email || !password) {
      message = "Please fill in all fields.";
      return;
    }

    const usernameValid = /^[A-Za-z0-9_]+$/.test(name);
    if (!usernameValid) {
      message = "Username may only contain letters, numbers and underscores (no spaces or special characters).";
      return;
    }

    if (password !== confirm) {
      message = "Passwords do not match.";
      return;
    }

    message = "Creating account...";

    try {
      const { res, data } = await register({ username: name, email, password });
      if (!res.ok) {
        message = data && data.message ? data.message : "Registration failed";
        notifier.error(message);
        return;
      }
      message = data.message || "Account created";
      name = "";
      email = "";
      password = "";
      confirm = "";
    } catch (error) {
      message = "Network error. Please try again.";
      notifier.error(message);
    }
  }
</script>

<div class="container mx-auto px-4">
  <div class="bg-gray-100 rounded-2xl shadow-xl overflow-hidden">
    <div class="py-4 md:py-6 px-6">
      <section class="max-w-md mx-auto mt-3 bg-white rounded shadow p-6">
        <h2 class="text-2xl font-semibold mb-4">Create account</h2>
        {#if message}
          <div class="mb-4 text-sm text-blue-700">{message}</div>
        {/if}
        <form on:submit={submit} class="space-y-4">
          <div>
            <label for="name" class="block text-sm mb-1">Name</label>
            <input id="name" class="w-full border rounded px-3 py-2" bind:value={name} />
          </div>
          <div>
            <label for="email" class="block text-sm mb-1">Email</label>
            <input id="email" type="email" class="w-full border rounded px-3 py-2" bind:value={email} />
          </div>
          <div>
            <label for="password" class="block text-sm mb-1">Password</label>
            <input id="password" type="password" class="w-full border rounded px-3 py-2" bind:value={password} />
          </div>
          <div>
            <label for="confirm" class="block text-sm mb-1">Confirm password</label>
            <input id="confirm" type="password" class="w-full border rounded px-3 py-2" bind:value={confirm} />
          </div>
          <div>
            <button class="bg-blue-600 text-white px-4 py-2 rounded">Create account</button>
          </div>
        </form>
      </section>
    </div>
  </div>
</div>
