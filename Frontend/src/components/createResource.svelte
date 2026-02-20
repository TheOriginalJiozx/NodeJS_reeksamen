<script>
  import { onMount } from "svelte";
  import {
    fetchTypes,
    fetchAllResources,
    fetchOwnedResources,
  } from "../fetcher/bookingFetchers.js";
  import { handleCreate } from "../handler/bookingHandlers.js";
  import logger from "../lib/logger.js";

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
        logger.error("Failed to fetch all resources",
          error && error.message ? error.message : error,
        );
      }
      try {
        resourcesOwned = await fetchOwnedResources();
      } catch (error) {
        logger.error(
          "Failed to fetch owned resources",
          error && error.message ? error.message : error,
        );
      }
    } catch (error) {
      logger.error(
        "Failed to fetch resource types",
        error && error.message ? error.message : error,
      );
    }
  });

  $: selectedType = types.find((type) => String(type.id) === String(create.type));
  $: isCarCreate = selectedType && /car/i.test(String(selectedType.name || ""));
  const brandModels = {
    Toyota: ["Yaris", "Corolla", "Prius", "Camry"],
    Ford: ["Fiesta", "Focus", "Mustang"],
    BMW: ["3 Series", "5 Series", "X3", "X5"],
    Mercedes: ["A-Class", "C-Class", "E-Class"],
    Volkswagen: ["Golf", "Polo", "Passat"],
    Honda: ["Civic", "Accord", "Jazz"],
  };
  $: modelsForBrand = createBrand && brandModels[createBrand] ? brandModels[createBrand] : [];

  async function submit() {
    if (submitting) return;
    submitting = true;
    try {
      const finalBrand = createBrand === "Other" ? (createBrandOther || "Other") : createBrand;
      let finalModel = "";
      if (createBrand === "Other") {
        finalModel = createModel || createModelCustom || "";
      } else if (modelsForBrand.length) {
        finalModel = createModelSelect === "Other" ? createModelCustom || "" : createModelSelect || "";
      } else {
        finalModel = createModel || "";
      }

      const res = await handleCreate(
        { create, isCarCreate, createBrand: finalBrand, createModel: finalModel, createYear },
        createImageFiles,
      );

      if (res && res.ok) {
        create = { name: "", type: "" };
        createImageFiles = [];
        createBrand = createModel = createYear = "";
        try {
          if (createImageInput) createImageInput.value = null;
        } catch (error) {
          logger.error("Failed to reset file input",
            error && error.message ? error.message : error,
          );
        }
        try {
          const all = await fetchAllResources();
          resourcesAll = all.resourcesAll || [];
        } catch (error) {
          logger.error("Failed to fetch all resources",
            error && error.message ? error.message : error,
          );
        }
        try {
          resourcesOwned = await fetchOwnedResources();
        } catch (error) {
          logger.error("Failed to fetch owned resources",
            error && error.message ? error.message : error,
          );
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
      <div class="grid grid-cols-3 gap-2">
        <select class="border rounded p-2" bind:value={createBrand}>
          <option value="">Brand</option>
          {#each Object.keys(brandModels) as brand}
            <option value={brand}>{brand}</option>
          {/each}
          <option value="Other">Other</option>
        </select>

        {#if createBrand === 'Other'}
          <input class="border rounded p-2" placeholder="Brand" bind:value={createBrandOther} />
          <input class="border rounded p-2" placeholder="Model" bind:value={createModelCustom} />
        {:else}
          {#if modelsForBrand.length}
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
          {:else}
            <input class="border rounded p-2" placeholder="Model" bind:value={createModel} />
          {/if}
        {/if}

        <select class="border rounded p-2" bind:value={createYear}>
          <option value="">Year</option>
          {#each years as year}
            <option value={year}>{year}</option>
          {/each}
        </select>
      </div>
    {/if}

    <input
      id="create-image"
      type="file"
      accept="image/*"
      multiple
      class="sr-only"
      bind:this={createImageInput}
      on:change={(event) => {
        createImageFiles = event.target.files ? Array.from(event.target.files) : [];
      }}
    />
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="bg-gray-200 text-gray-800 px-3 py-1 rounded"
        on:click={() => createImageInput && createImageInput.click()}>Choose images</button
      >
      {#if createImageFiles.length}
        <div class="text-sm">
          {createImageFiles.length} file(s): {createImageFiles.map(f=>f.name).join(", ")}
        </div>
      {/if}
    </div>

    <div class="flex gap-2">
      <button class="bg-blue-600 text-white px-4 py-2 rounded" on:click|preventDefault={submit} disabled={submitting}>
        {#if submitting}Creating...{:else}Create{/if}
      </button>
    </div>
  </div>
</section>
