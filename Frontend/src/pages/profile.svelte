<script>
  import { onMount } from 'svelte';
  import { navigate } from '../lib/router.js';
  import { toast } from '../store/toastStore.js';

  let user = null;
  let loading = true;
  let message = '';
  let deleting = false;

  async function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This will remove your resources and related data.')) return;
    deleting = true;
    try {
      const res = await fetch('/api/users/me', { method: 'DELETE', credentials: 'include' });
      const content = res.headers.get('content-type') || '';
      let data = {};
      if (content.includes('application/json')) data = await res.json();
      else data = { message: await res.text() };

      if (res.ok) {
        toast(data.message || 'Account deleted', 'success');
        navigate('/');
        return;
      }

      if (res.status === 409) {
        toast(data.message || 'Cannot delete account while active bookings exist', 'error');
      } else {
        toast(data.message || 'Failed to delete account', 'error');
      }
    } catch (error) {
      toast('Failed to delete account', 'error');
    } finally {
      deleting = false;
    }
  }

  onMount(async () => {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.status === 401) {
        navigate('/login');
        return;
      }

      let data = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { message: text };
      }

      user = data.user || null;
    } catch (error) {
      message = 'Could not load profile.';
    } finally {
      loading = false;
    }
  });
</script>

<section class="max-w-lg mx-auto mt-12 bg-white rounded shadow p-6">
  <h2 class="text-2xl font-semibold mb-4">Profile</h2>

  {#if loading}
    <div class="text-gray-600">Loading...</div>
  {:else}
    {#if user}
      <div class="space-y-2">
        <div><strong>Username:</strong> {user.username}</div>
        <div><strong>Email:</strong> {user.email}</div>
        <div><strong>Role:</strong> {user.role}</div>
        <button class="bg-blue-600 text-white px-3 py-1 rounded" on:click={() => navigate('/mybookings')}>My bookings</button>
        <button class="bg-blue-600 text-white px-3 py-1 rounded" on:click={() => navigate('/myresources')}>My resources</button>
        <button
          class="bg-red-600 text-white px-3 py-1 rounded ml-2"
          on:click|preventDefault={deleteAccount}
          disabled={deleting}
        >
          {#if deleting}Deleting...{:else}Delete account{/if}
        </button>
        
      </div>
    {:else}
      <div class="text-red-600">{message}</div>
    {/if}
  {/if}
</section>
