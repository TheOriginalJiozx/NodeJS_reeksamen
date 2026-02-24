<script>
  import { fetchAvailability } from "../../fetcher/bookingFetchers.js";

  export let resourceId = null;
  export let availabilities = [];
  export let onDelete = async () => {};

  async function handleDelete(availabilityId) {
    await onDelete(resourceId, availabilityId);
    availabilities = (await fetchAvailability(resourceId)).availability || [];
  }
</script>

<div class="text-sm font-semibold mb-2">Availabilities</div>
{#if Array.isArray(availabilities) && availabilities.length > 0}
  <ul class="text-sm space-y-1 mb-3">
    {#each availabilities as available}
      <li class="flex items-center justify-between">
        <div>{available.startDate} — {available.endDate}</div>
        <div>
          <button class="bg-red-600 text-white px-2 py-1 rounded" on:click={() => handleDelete(available.id || available.insertId)}>Delete</button>
        </div>
      </li>
    {/each}
  </ul>
{:else}
  <div class="text-xs text-gray-600 mb-3">No availabilities</div>
{/if}
