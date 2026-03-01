<script>
  import notifier from "../../lib/notifier.js";

  export let defectImages = [];
  export let defectImageInput = null;

  const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/jpg"];
  const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
  let dragOverActive = false;

  function validateFile(file) {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return false;
    }
    return true;
  }

  function addImages(files) {
    Array.from(files).forEach((file) => {
      if (!validateFile(file)) {
        notifier.error(`Invalid file type: ${file.name}. We only accept: ${ALLOWED_EXTENSIONS.join(", ")}`);
        return;
      }
      
      const existingIndex = defectImages.findIndex(existingFile => existingFile.name === file.name && existingFile.size === file.size);
      if (existingIndex !== -1) {
        defectImages = defectImages.filter((_image, index) => index !== existingIndex);
      }
      
      defectImages = [...defectImages, file];
    });
  }

  function handleImageSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    addImages(files);
    event.target.value = "";
  }

  function removeImage(index) {
    defectImages = defectImages.filter((_image, imageIndex) => imageIndex !== index);
  }

  function handleDragOver(event) {
    event.preventDefault();
    dragOverActive = true;
  }

  function handleDragLeave(event) {
    event.preventDefault();
    dragOverActive = false;
  }

  function handleDrop(event) {
    event.preventDefault();
    dragOverActive = false;
    const files = event.dataTransfer?.files;
    if (files) addImages(files);
  }
</script>

<label for="defect-photo" class="block text-base font-semibold mb-3">Defect Photos <span class="text-red-600">*</span></label>

<div
  role="region"
  aria-label="Drag and drop area for defect images"
  class="border-2 border-dashed rounded-lg p-8 mb-6 text-center transition {dragOverActive
    ? 'border-blue-500 bg-blue-50'
    : 'border-gray-300 bg-gray-50'}"
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
>
  <div class="text-gray-600 mb-4">
    <div class="text-base font-medium mb-2">Drag images here or click to select</div>
    <div class="text-sm text-gray-500">Supported: {ALLOWED_EXTENSIONS.join(", ")}</div>
  </div>
  <input
    id="defect-photo"
    type="file"
    accept="image/jpeg,image/png,image/jpg"
    multiple
    class="hidden"
    bind:this={defectImageInput}
    on:change={handleImageSelect}
  />
  <label for="defect-photo" class="inline-block bg-blue-600 text-white px-6 py-2 rounded text-base font-medium cursor-pointer hover:bg-blue-700">
    Select Images
  </label>
</div>

{#if defectImages.length > 0}
  <div class="mb-6">
    <div class="text-sm font-semibold text-gray-700 mb-3">Selected Images ({defectImages.length})</div>
    <div class="grid grid-cols-4 gap-3">
      {#each defectImages as file, index}
        <div class="relative group">
          <img
            src={URL.createObjectURL(file)}
            alt={file.name}
            class="w-full h-24 object-cover rounded border border-gray-300"
          />
          <button
            type="button"
            class="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs font-bold"
            on:click={() => removeImage(index)}
          >
            ✕
          </button>
          <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
            {file.name}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
