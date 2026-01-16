<script>
  import { onMount } from "svelte";
  import { fetchTypes, fetchAllResources, fetchOwnedResources } from "../fetcher/bookingFetchers.js";
  import { handleCreate } from "../handler/bookingHandlers.js";
  import { toast } from "../store/toastStore.js";
  import logger from "../lib/logger.js";

  let types = [];
  let create = { name: "", type: "" };
  let createImageFile = null;
  let createImageInput = null;
  let createBrand = "";
  let createModel = "";
  let createYear = "";
  let resourcesAll = [];
  let resourcesOwned = [];

  onMount(async () => {
    try {
      types = await fetchTypes();
      try {
        const all = await fetchAllResources();
        resourcesAll = all.resourcesAll || [];
      } catch (error) {
        logger.error("Failed to fetch all resources", error && error.message ? error.message : error);
      }
      try {
        resourcesOwned = await fetchOwnedResources();
      } catch (error) {
        logger.error("Failed to fetch owned resources", error && error.message ? error.message : error);
      }
    } catch (error) {
      logger.error("Failed to fetch resource types", error && error.message ? error.message : error);
    }
  });

  async function submit() {
    const res = await handleCreate(
      { create, createBrand, createModel, createYear },
      createImageFile,
    );
    if (res && res.ok) {
      toast("Resource created", "success");
      create = { name: "", type: "" };
      createImageFile = null;
      createBrand = createModel = createYear = "";
      try {
        const all = await fetchAllResources();
        resourcesAll = all.resourcesAll || [];
      } catch (error) {
        logger.error("Failed to fetch all resources", error && error.message ? error.message : error);
      }
      try {
        resourcesOwned = await fetchOwnedResources();
      } catch (error) {
        logger.error("Failed to fetch owned resources", error && error.message ? error.message : error);
      }
    }
  }
</script>

<section class="bg-white p-4 rounded shadow">
  <h2 class="font-semibold mb-2">Create Resource</h2>
  <div class="space-y-2">
    <input
      class="w-full border rounded p-2"
      placeholder="Name"
      bind:value={create.name}
    />
    <select class="w-full border rounded p-2" bind:value={create.type}>
      <option value="">Select type</option>
      {#each types as type}
        <option value={type.id}>{type.name}</option>
      {/each}
    </select>

    <input
      id="create-image"
      type="file"
      accept="image/*"
      class="sr-only"
      bind:this={createImageInput}
      on:change={(event) => {
        createImageFile =
          event.target.files && event.target.files[0]
            ? event.target.files[0]
            : null;
      }}
    />
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="bg-gray-200 text-gray-800 px-3 py-1 rounded"
        on:click={() => createImageInput && createImageInput.click()}
        >Choose image</button
      >
      {#if createImageFile}<span class="text-sm">{createImageFile.name}</span
        >{/if}
    </div>

    <div class="flex gap-2">
      <button
        class="bg-blue-600 text-white px-4 py-2 rounded"
        on:click|preventDefault={submit}>Create</button
      >
    </div>
  </div>
</section>
