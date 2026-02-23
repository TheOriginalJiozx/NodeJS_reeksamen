<script>
  import { onDestroy } from "svelte";
  import logger from "../lib/logger.js";

  export let images = [];
  export let resourceName = "";

  let previewImage = null;
  let previewImages = [];
  let previewIndex = 0;

  function openPreview(image) {
    previewImages = images.slice();
    previewIndex = previewImages.indexOf(image);
    if (previewIndex === -1) previewIndex = 0;
    previewImage = previewImages[previewIndex] || null;
  }

  function onPreviewKey(event) {
    if (!previewImage || !previewImages || !previewImages.length) return;
    if (event.key === "ArrowRight") {
      previewIndex = (previewIndex + 1) % previewImages.length;
      previewImage = previewImages[previewIndex];
    } else if (event.key === "ArrowLeft") {
      previewIndex = (previewIndex - 1 + previewImages.length) % previewImages.length;
      previewImage = previewImages[previewIndex];
    } else if (event.key === "Escape") {
      previewImage = null;
    }
  }

  $: if (previewImage) {
    window.addEventListener("keydown", onPreviewKey);
  } else {
    window.removeEventListener("keydown", onPreviewKey);
  }

  onDestroy(() => {
    window.removeEventListener("keydown", onPreviewKey);
  });
</script>

{#if images.length}
  <div class="mt-2">
    <div class="flex items-center gap-3 mb-2">
      <div class="text-sm text-gray-600">Click on images to preview</div>
      <div class="text-xs text-gray-600">(use left and right arrows to change)</div>
    </div>
    <div class="flex items-center gap-3">
      {#each images.slice(0, 3) as image}
        <div class="relative inline-block">
          <button type="button" class="p-0" on:click={() => openPreview(image)} aria-label="Preview image">
            <img src={image} alt={resourceName} class="h-12 rounded border" />
          </button>
        </div>
      {/each}
      {#if images.length > 3}
        <div class="text-sm text-gray-600">+{images.length - 3}</div>
      {/if}
    </div>
  </div>
{/if}

{#if previewImage}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div
      class="absolute inset-0 bg-black/60"
      role="button"
      tabindex="0"
      on:click={() => (previewImage = null)}
      on:keydown={(event) => {
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          previewImage = null;
          event.preventDefault();
        }
      }}
    ></div>
    <img src={previewImage} alt="Preview" class="max-w-[90vw] max-h-[90vh] rounded shadow-lg z-50" />
    <button class="absolute top-4 right-4 bg-white text-gray-800 rounded-full p-2 z-60" on:click={() => (previewImage = null)}>✕</button>
  </div>
{/if}
