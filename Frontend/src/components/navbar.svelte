<script>
  import { onMount } from 'svelte';
  import { navigate } from '../lib/router.js';
  import user, { bootstrap, clearUser } from '../store/userStore.js';
  import { toast } from '../store/toastStore.js';

  onMount(() => {
    bootstrap();
  });

  async function handleLogout(event) {
    event.preventDefault();
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (error) {
      toast(error && error.message ? error.message : 'Network error', 'error');
    }
    clearUser();
    navigate('/login');
  }
</script>

<nav class="bg-blue-600 text-white p-4">
  <div class="container mx-auto flex items-center justify-between">
    <h1 class="text-xl font-semibold">Booking</h1>
    <div class="space-x-4">
      <a href="/" class="text-white/90 hover:text-white">Home</a>
      {#if $user}
        <a href="/profile" class="text-white/90 hover:text-white">Profile</a>
        <a href="/booking" class="text-white/90 hover:text-white">Book</a>
        <button type="button" on:click={handleLogout} class="bg-red-600 text-white px-4 py-2 rounded">Logout</button>
      {:else}
        <a href="/register" class="text-white/90 hover:text-white">Register</a>
        <a href="/login" class="text-white/90 hover:text-white">Login</a>
      {/if}
    </div>
  </div>
</nav>
