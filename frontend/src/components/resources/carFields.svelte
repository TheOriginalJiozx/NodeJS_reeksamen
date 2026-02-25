<script>
  export let createBrand = "";
  export let createModel = "";
  export let createBrandOther = "";
  export let createModelSelect = "";
  export let createModelCustom = "";
  export let createYear = "";
  export let years = [];

  const brandModels = {
    Toyota: ["Yaris", "Corolla", "Prius", "Camry"],
    Ford: ["Fiesta", "Focus", "Mustang"],
    BMW: ["3 Series", "5 Series", "X3", "X5"],
    Mercedes: ["A-Class", "C-Class", "E-Class"],
    Volkswagen: ["Golf", "Polo", "Passat"],
    Honda: ["Civic", "Accord", "Jazz"],
  };

  $: modelsForBrand = createBrand && brandModels[createBrand] ? brandModels[createBrand] : [];
</script>

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
    {:else}
      <input class="border rounded p-2" placeholder="Model" bind:value={createModel} />
    {/if}

    <select class="border rounded p-2" bind:value={createYear}>
      <option value="">Year</option>
      {#each years as year}
        <option value={year}>{year}</option>
      {/each}
    </select>
  </div>
