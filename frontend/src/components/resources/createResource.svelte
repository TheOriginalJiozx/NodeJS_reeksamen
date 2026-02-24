<script>
  import { onMount } from "svelte";
  import { fetchTypes, fetchAllResources } from "../../fetcher/bookingFetchers.js";
  import apiFetch from "../../lib/api.js";
  import CarFields from "./carFields.svelte";
  import ImageUploader from "./imageUploader.svelte";
  import { handleCreate } from "../../handler/bookingHandlers.js";
  import logger from "../../lib/logger.js";

  let types = [];
  let create = { name: "", type: "" };
  let createImageFiles = [];
  let createImageInput = null;
  let createBrand = "";
  let createModel = "";
  let createBrandOther = "";
  let createModelSelect = "";
  let createModelCustom = "";
  let createYear = "";
  let resourcesAll = [];
  let resourcesOwned = [];
  let submitting = false;

  const startYear = 1990;
  $: years = Array.from({ length: new Date().getFullYear() - startYear + 1 }, (_, index) => startYear + index);

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
        const cached = localStorage.getItem("user");
        const parsed = cached ? JSON.parse(cached) : null;
        const userId = parsed?.id;
        if (userId) {
          const r = await apiFetch(`/api/users/${userId}/resources`);
          if (r.ok) resourcesOwned = await r.json();
        }
      } catch (error) {
        logger.error("Failed to fetch owned resources", error && error.message ? error.message : error);
      }
    } catch (error) {
      logger.error("Failed to fetch resource types", error && error.message ? error.message : error);
    }
  });

  $: selectedType = types.find((type) => String(type.id) === String(create.type));
  $: isCarCreate = selectedType && /car/i.test(String(selectedType.name));

  async function submit() {
    if (submitting) return;
    submitting = true;
    try {
      const finalBrand = createBrand === "Other" ? createBrandOther || "Other" : createBrand;
      let finalModel = "";
      if (createBrand === "Other") {
        finalModel = createModel || createModelCustom || "";
      } else if (createBrand) {
        finalModel = createModelSelect === "Other" ? createModelCustom || "" : createModelSelect || "";
      } else {
        finalModel = createModel || "";
      }

      const res = await handleCreate({ create, isCarCreate, createBrand: finalBrand, createModel: finalModel, createYear }, createImageFiles);

      if (res && res.ok) {
        create = { name: "", type: "" };
        createImageFiles = [];
        createBrand = createModel = createYear = "";
        try {
          if (createImageInput) createImageInput.value = null;
        } catch (error) {
          logger.error("Failed to reset file input", error && error.message ? error.message : error);
        }
        try {
          const all = await fetchAllResources();
          resourcesAll = all.resourcesAll || [];
        } catch (error) {
          logger.error("Failed to fetch all resources", error && error.message ? error.message : error);
        }
        try {
          const cached = localStorage.getItem("user");
          const parsed = cached ? JSON.parse(cached) : null;
          const userId = parsed?.id;
          if (userId) {
            const resources = await apiFetch(`/api/users/${userId}/resources`);
            if (resources.ok) resourcesOwned = await resources.json();
          }
        } catch (error) {
          logger.error("Failed to fetch owned resources", error && error.message ? error.message : error);
        }
      }
    } finally {
      submitting = false;
    }
  }
</script>

<section class="bg-white p-4 rounded shadow">
  <h2 class="font-semibold mb-2">Create Resource</h2>
  <div class="space-y-2">
    {#if !isCarCreate}
      <input class="w-full border rounded p-2" placeholder="Name" bind:value={create.name} />
    {/if}

    <select class="w-full border rounded p-2" bind:value={create.type}>
      <option value="">Select type</option>
      {#each types as type}
        <option value={type.id}>{type.name}</option>
      {/each}
    </select>

    {#if isCarCreate}
      <CarFields bind:createBrand bind:createModel bind:createBrandOther bind:createModelSelect bind:createModelCustom bind:createYear {years} />
    {/if}

    <ImageUploader bind:createImageFiles bind:createImageInput />

    <div class="flex gap-2">
      <button class="bg-blue-600 text-white px-4 py-2 rounded" on:click|preventDefault={submit} disabled={submitting}>
        {#if submitting}Creating...{:else}Create{/if}
      </button>
    </div>
  </div>
</section>
