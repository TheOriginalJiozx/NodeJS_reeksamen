<script>
  export let bookings = [];
  export let confirm = () => {};
  export let decline = () => {};
</script>

{#if Array.isArray(bookings) && bookings.length > 0}
  <ul class="space-y-1 text-sm">
    {#each bookings as booking}
      <li class="flex items-center justify-between">
        <div>
          <div><strong>{booking.booker}</strong></div>
          <div class="text-xs text-gray-600">{booking.startDate} — {booking.endDate}</div>
        </div>
        <div>
          {#if booking.confirmed === 1}
            <span class="text-sm text-green-600">Confirmed</span>
          {:else if booking.confirmed === 2}
            <span class="text-sm text-red-600">Declined</span>
          {:else}
            <div class="flex gap-2">
              <button type="button" class="bg-blue-600 text-white px-2 py-1 rounded" on:click={() => confirm(booking.id)}>Confirm</button>
              <button type="button" class="bg-gray-300 text-gray-800 px-2 py-1 rounded" on:click={() => decline(booking.id)}>Decline</button>
            </div>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
{:else}
  <div class="text-sm text-gray-600">No bookings</div>
{/if}
