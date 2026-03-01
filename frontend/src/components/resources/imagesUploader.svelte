<script>
  export let createImageFiles = [];
  export let createImageInput = null;
  import { onMount } from "svelte";
  import notifier from "../../lib/notifier.js";

  const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png"];
  const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png"];

  function validateFile(file) {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return false;
    }
    return true;
  }

  function handleChange(event) {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      const validFiles = [];
      const invalidFiles = [];

      newFiles.forEach((file) => {
        if (validateFile(file)) {
          validFiles.push(file);
        } else {
          invalidFiles.push(file.name);
        }
      });

      if (invalidFiles.length > 0) {
        notifier.error(`Invalid file type. We only accept: ${ALLOWED_EXTENSIONS.join(", ")}`);
      }

      if (validFiles.length > 0) {
        createImageFiles = [...createImageFiles, ...validFiles];
      }
    }
    event.target.value = "";
  }

  function removeFile(indexToRemove) {
    createImageFiles = createImageFiles.filter((_file, index) => index !== indexToRemove);
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
      {createImageFiles.length} file(s):
      <ul class="list-disc list-inside mt-1 text-xs">
        {#each createImageFiles as file, index}
          <li class="flex justify-between items-center">
            <span>{file.name}</span>
            <button
              type="button"
              class="ml-2 text-red-600 hover:text-red-800 text-xs font-semibold"
              on:click={() => removeFile(index)}
            >
              Remove
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
