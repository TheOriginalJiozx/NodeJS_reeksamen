<script>
  let username = '';
  let password = '';
  let message = '';

  import { navigate, route } from '../lib/router.js';
  import { toast } from '../store/toastStore.js';
  import { setUser } from '../store/userStore.js';

  async function submit(event) {
    event.preventDefault();
    if (!username || !password) {
      message = 'Please enter username and password.';
      return;
    }

    message = 'Logging in...';

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      let data = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { message: text };
      }

      if (!res.ok) {
        message = data && data.message ? data.message : 'Login failed';
        return;
      }

      message = data.message || 'Login successful';
      toast('Successfully logged in', 'success');
      if (data.user) setUser(data.user);
      username = '';
      password = '';
      navigate('/profile');
      route.set('/profile');
    } catch (error) {
      message = 'Network error. Please try again.';
      toast(error && error.message ? error.message : 'Network error', 'error');
    }
  }
</script>

<section class="max-w-md mx-auto mt-12 bg-white rounded shadow p-6">
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
