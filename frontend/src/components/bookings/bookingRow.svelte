<script>
  import { createEventDispatcher } from "svelte";
  export let booking;
  export let resourceMap = {};

  const dispatch = createEventDispatcher();

  function getImages(images) {
    return String(images || "")
      .split(";")
      .filter(Boolean);
  }

  function openPreview(imagesString, label, startIndex = 0) {
    dispatch("openPreview", { imagesString, label, startIndex });
  }
</script>

<tr class="align-top border-b">
  <td class="py-2">
    {#if resourceMap[String(booking.resourceId)]}
      {resourceMap[String(booking.resourceId)].name}
    {:else}
      Resource {booking.resourceId}
    {/if}
  </td>
  <td class="py-2">
    {booking.startDate} — {booking.endDate || booking.startDate}
  </td>
  <td class="py-2">
    {#if booking.confirmed === 1}
      <span class="text-sm text-green-600">Confirmed</span>
    {:else if booking.confirmed === 2}
      <span class="text-sm text-red-600">Declined</span>
    {:else}
      <span class="text-sm text-gray-600">Pending</span>
    {/if}
  </td>
  <td class="py-2">{booking.comment || ""}</td>
  <td class="py-2">
    {#if booking.image}
      {#each getImages(booking.image).slice(0, 3) as image, index}
        <button type="button" on:click={() => openPreview(booking.image, resourceMap[String(booking.resourceId)] && resourceMap[String(booking.resourceId)].name, index)} class="p-0 rounded overflow-hidden mr-1" aria-label={"Open image preview for " + ((resourceMap[String(booking.resourceId)] && resourceMap[String(booking.resourceId)].name) || "resource")}>
          <img src={image} alt="" class="h-8 w-12 object-cover rounded border" aria-hidden="true" />
        </button>
      {/each}
      {#if getImages(booking.image).length > 3}
        <span class="text-xs text-gray-600">(+{getImages(booking.image).length - 3})</span>
      {/if}
    {:else if resourceMap[String(booking.resourceId)] && resourceMap[String(booking.resourceId)].image}
      {#each getImages(resourceMap[String(booking.resourceId)].image).slice(0, 3) as image, index}
        <button type="button" on:click={() => openPreview(resourceMap[String(booking.resourceId)].image, resourceMap[String(booking.resourceId)].name, index)} class="p-0 rounded overflow-hidden mr-1" aria-label={"Open image preview for " + ((resourceMap[String(booking.resourceId)] && resourceMap[String(booking.resourceId)].name) || "resource")}>
          <img src={image} alt="" class="h-8 w-12 object-cover rounded border" aria-hidden="true" />
        </button>
      {/each}
      {#if getImages(resourceMap[String(booking.resourceId)].image).length > 3}
        <span class="text-xs text-gray-600">(+{getImages(resourceMap[String(booking.resourceId)].image).length - 3})</span>
      {/if}
    {:else}
      —
    {/if}
  </td>
</tr>
