<script>
  import { toasts, remove } from '../store/toastStore.js';
</script>

<div class="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 space-y-2 p-2">
  {#each $toasts as toast (toast.id)}
    <div
      role="status"
      aria-live="polite"
      class="min-w-[200px] max-w-sm px-4 py-2 rounded shadow-lg text-white flex items-center justify-between"
      class:bg-green-600={toast.type === 'success'}
      class:bg-red-600={toast.type === 'error'}
    >
      <div class="pr-4">{toast.message}</div>
      <button
        type="button"
        class="ml-4 text-white opacity-90 hover:opacity-100 focus:outline-none"
        on:click={() => remove(toast.id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  {/each}
</div>
