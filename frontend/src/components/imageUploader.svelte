<script>
  export let createImageFiles = [];
  export let createImageInput = null;
  import { onMount } from "svelte";

  function handleChange(event) {
    createImageFiles = event.target.files ? Array.from(event.target.files) : [];
  }

  onMount(() => {});
</script>

<input
  id="create-image"
  type="file"
  accept="image/*"
  multiple
  class="sr-only"
  bind:this={createImageInput}
  on:change={handleChange}
/>
<div class="flex items-center gap-2">
  <button type="button" class="bg-gray-200 text-gray-800 px-3 py-1 rounded" on:click={() => createImageInput && createImageInput.click()}>Choose images</button>
  {#if createImageFiles.length}
    <div class="text-sm">
      {createImageFiles.length} file(s): {createImageFiles.map((file) => file.name).join(", ")}
    </div>
  {/if}
</div>
