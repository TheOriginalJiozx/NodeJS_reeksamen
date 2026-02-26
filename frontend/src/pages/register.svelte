<script>
  import { onMount } from "svelte";
  import notifier from "../lib/notifier.js";
  import { authUser } from "../store/usersStore.js";
  import { navigate, route } from "../lib/router.js";
  import logger from "../lib/logger.js";
  import { apiFetch } from "../lib/api.js";
  import responseUtils from "../utils/responseUtils.js";

  let name = "";
  let fullName = "";
  let email = "";
  let password = "";
  let confirm = "";

  onMount(() => {
    if ($authUser) {
      navigate("/profile");
      route.set("/profile");
    }
  });

  async function submit(event) {
    event.preventDefault();

    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, fullname: fullName, email, password, confirmPassword: confirm }),
      });

      const data = await responseUtils.parseResponse(res);

      if (!res.ok) {
        const errMsg = responseUtils.getErrorMessage(data, "Registration failed");
        notifier.error(errMsg);
        return;
      }

        const successMsg = responseUtils.getSuccessMessage(data, "Account created");
      notifier.success(successMsg);
      name = "";
      fullName = "";
      email = "";
      password = "";
      confirm = "";
    } catch (error) {
      const errorMessage = error && error.message ? error.message : "Network error";
      notifier.error(errorMessage);
      logger.error("Registration error", errorMessage);
    }
  }
</script>

<div class="container mx-auto px-4">
  <div class="bg-gray-100 rounded-2xl shadow-xl overflow-hidden">
    <div class="py-4 md:py-6 px-6">
      <section class="max-w-md mx-auto mt-3 bg-white rounded shadow p-6">
        <h2 class="text-2xl font-semibold mb-4">Create account</h2>
        <form on:submit={submit} class="space-y-4">
          <div>
            <label for="name" class="block text-sm mb-1">Username</label>
            <input id="name" autocomplete="username" class="w-full border rounded px-3 py-2" bind:value={name} />
          </div>
          <div>
            <label for="fullname" class="block text-sm mb-1">Full name</label>
            <input id="fullname" autocomplete="fullName" class="w-full border rounded px-3 py-2" bind:value={fullName} />
          </div>
          <div>
            <label for="email" class="block text-sm mb-1">Email</label>
            <input id="email" autocomplete="email" class="w-full border rounded px-3 py-2" bind:value={email} />
          </div>
          <div>
            <label for="password" class="block text-sm mb-1">Password</label>
            <input id="password" type="password" autocomplete="new-password" class="w-full border rounded px-3 py-2" bind:value={password} />
          </div>
          <div>
            <label for="confirm" class="block text-sm mb-1">Confirm password</label>
            <input id="confirm" type="password" autocomplete="new-password" class="w-full border rounded px-3 py-2" bind:value={confirm} />
          </div>
          <div>
            <button class="bg-blue-600 text-white px-4 py-2 rounded">Create account</button>
          </div>
        </form>
      </section>
    </div>
  </div>
</div>
