<script>
  import bookingFetchers from "../../fetchers/bookingFetchers.js";
  import notifier from "../../lib/notifier.js";

  export let resourceId = null;
  export let availabilities = [];
  export let onDelete = async () => {};

  async function handleDelete(availabilityId) {
    if (!resourceId || !availabilityId) {
      notifier.error("Invalid resource or availability ID");
      return;
    }
    
    const availability = availabilities.find(a => (a.id || a.insertId) === availabilityId);
    if (!availability) {
      notifier.error("Availability not found in this resource");
      return;
    }
    
    const result = await onDelete(resourceId, availabilityId);
    if (result === false) return;
    try {
      availabilities = (await bookingFetchers.fetchAvailability(resourceId)).availability || [];
    } catch (error) {
      notifier.error("Failed to refresh availabilities");
    }
  }
</script>

<div class="text-sm font-semibold mb-2">Availabilities</div>
{#if Array.isArray(availabilities) && availabilities.length > 0}
  <ul class="text-sm space-y-1 mb-3">
    {#each availabilities as available (available.id || available.insertId)}
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
