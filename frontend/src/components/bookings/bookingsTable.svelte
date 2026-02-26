<script>
  import BookingRow from "./bookingRow.svelte";

  export let bookings = [];
  export let resourceMap = {};

  function handleOpenPreview(event) {
    dispatchEvent(new CustomEvent("openPreview", { detail: event.detail }));
  }
</script>

{#if bookings.length === 0}
  <div class="text-gray-600">You have no bookings.</div>
{:else}
  <table class="w-full text-left border-collapse">
    <thead>
      <tr class="text-sm text-gray-600 border-b">
        <th class="py-2">Resource</th>
        <th class="py-2">Dates</th>
        <th class="py-2">Status</th>
        <th class="py-2">Comment</th>
        <th class="py-2">Image(s)</th>
      </tr>
    </thead>
    <tbody>
      {#each bookings as booking}
        <BookingRow
          {booking}
          {resourceMap}
          on:openPreview={(event) => handleOpenPreview(event.detail)}
        />
      {/each}
    </tbody>
  </table>
{/if}
