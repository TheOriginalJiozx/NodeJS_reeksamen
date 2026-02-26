<script>
  export let imagesString = "";
  export let resource = {};
  export let open = () => {};

  function getImages(imageString) {
    return String(imageString).split(";").filter(Boolean);
  }
</script>

{#if imagesString}
  {#each getImages(imagesString).slice(0,3) as image}
    <div class="relative inline-block mr-2">
      <button type="button" class="p-0 rounded overflow-hidden" on:click={() => open(resource, image)} aria-label={`Preview ${resource.name}`}>
        <img src={image} alt={resource.name || ''} class="h-8 w-12 object-cover rounded border" />
      </button>
    </div>
  {/each}
  {#if String(imagesString).includes(";")}
    <div class="text-xs text-gray-600">({getImages(imagesString).length} images)</div>
  {/if}
{:else}
  —
{/if}
