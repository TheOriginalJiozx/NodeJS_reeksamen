<script>
  import { onMount } from "svelte";
  import { apiFetch } from "../../lib/api.js";
  import logger from "../../lib/logger.js";

  export let createBrand = "";
  export let createModel = "";
  export let createBrandOther = "";
  export let createModelSelect = "";
  export let createModelCustom = "";
  export let createYear = "";
  export let years = [];

  let brands = [];
  let models = [];
  let loading = false;

  onMount(async () => {
    try {
      loading = true;
      const response = await apiFetch("/api/car-brands");
      const brandsData = response.ok ? await response.json() : [];
      brands = brandsData || [];
      logger.debug({ brandsCount: brands.length }, "Loaded car brands");
    } catch (error) {
      logger.error("Failed to load car brands", error && error.message ? error.message : error);
    } finally {
      loading = false;
    }
  });

  async function loadModelsForBrand(brandName) {
    if (!brandName) {
      models = [];
      return;
    }
    try {
      const brand = brands.find(brand => brand.name === brandName);
      if (!brand) {
        models = [];
        return;
      }
      const response = await apiFetch(`/api/car-brands/${brand.id}/models`);
      const modelsData = response.ok ? await response.json() : [];
      models = modelsData || [];
      logger.debug({ brandName, modelsCount: models.length }, "Loaded car models for brand");
    } catch (error) {
      logger.error("Failed to load car models", error && error.message ? error.message : error);
      models = [];
    }
  }

  $: if (createBrand && createBrand !== "Other") {
    loadModelsForBrand(createBrand);
  } else {
    models = [];
  }

  $: modelsForBrand = models.map(model => model.name) || [];
</script>

<div class="grid grid-cols-3 gap-2">
  <select class="border rounded p-2" bind:value={createBrand} disabled={loading}>
      <option value="">Brand</option>
      {#each brands as brand}
        <option value={brand.name}>{brand.name}</option>
      {/each}
      <option value="Other">Other</option>
    </select>

    {#if createBrand === 'Other'}
      <input class="border rounded p-2" placeholder="Brand" bind:value={createBrandOther} />
      <input class="border rounded p-2" placeholder="Model" bind:value={createModelCustom} />
    {:else if modelsForBrand.length}
      <select class="border rounded p-2" bind:value={createModelSelect}>
        <option value="">Model</option>
        {#each modelsForBrand as model}
          <option value={model}>{model}</option>
        {/each}
        <option value="Other">Other</option>
      </select>
      {#if createModelSelect === 'Other'}
        <input class="border rounded p-2" placeholder="Model" bind:value={createModelCustom} />
      {/if}
    {:else if createBrand && createBrand !== "Other"}
      <input class="border rounded p-2" placeholder="Model" bind:value={createModel} />
    {/if}

    <select class="border rounded p-2" bind:value={createYear}>
      <option value="">Year</option>
      {#each years as year}
        <option value={year}>{year}</option>
      {/each}
    </select>
  </div>
