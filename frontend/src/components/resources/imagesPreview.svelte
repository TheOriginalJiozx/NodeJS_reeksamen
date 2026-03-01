<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  export let images = [];
  export let startIndex = 0;
  export let label = 'Image preview';

  const dispatch = createEventDispatcher();

  let index = Math.max(0, Math.min(startIndex || 0, (images || []).length - 1));
  $: current = (images && images[index]) || null;

  function close() {
    dispatch('close');
  }

  function prev() {
    if (!images || images.length === 0) return;
    index = (index - 1 + images.length) % images.length;
  }

  function next() {
    if (!images || images.length === 0) return;
    index = (index + 1) % images.length;
  }

  function onKey(event) {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') prev();
    if (event.key === 'ArrowRight') next();
  }

  onMount(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', onKey);
  });
</script>

{#if current}
  <div
    class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
    role="dialog"
    aria-modal="true"
    tabindex="0"
    on:click={(event) => { if (event.target === event.currentTarget) close(); }}
    on:keydown={onKey}
  >
    <div class="relative max-w-3xl max-h-[80vh]">
      <img src={current} alt={label} class="max-w-full max-h-[80vh] rounded shadow-lg" />
      <button type="button" class="absolute top-2 right-2 text-white text-2xl" on:click|stopPropagation={close} aria-label="Close preview">×</button>
      {#if images.length > 1}
        <button type="button" class="absolute left-2 top-1/2 -translate-y-1/2 text-white text-3xl" on:click|stopPropagation={prev} aria-label="Previous image">&lsaquo;</button>
        <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-white text-3xl" on:click|stopPropagation={next} aria-label="Next image">&rsaquo;</button>
      {/if}
    </div>
  </div>
{/if}
