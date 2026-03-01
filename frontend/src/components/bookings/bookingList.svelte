<script>
  export let bookings = [];
  export let confirm = () => {};
  export let decline = () => {};
  export let onPreview = () => {};
</script>

{#if Array.isArray(bookings) && bookings.length > 0}
  <ul class="space-y-3 text-sm">
    {#each bookings as booking}
      <li class="p-3 border rounded bg-white">
        <div class="flex items-center justify-between mb-2">
          <div class="flex-1">
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
                <button type="button" class="bg-blue-600 text-white px-2 py-1 rounded text-xs" on:click={() => confirm(booking.id)}>Confirm</button>
                <button type="button" class="bg-gray-300 text-gray-800 px-2 py-1 rounded text-xs" on:click={() => decline(booking.id)}>Decline</button>
              </div>
            {/if}
          </div>
        </div>

        {#if booking.defect_reported}
          <div class="mt-3 p-2 bg-red-50 border border-red-200 rounded">
            <div class="text-xs font-semibold text-red-700 mb-1">Defect Reported:</div>
            <div class="text-xs text-red-600 mb-2">{booking.defect_reported}</div>
            {#if booking.defect_image}
              {@const defectImages = String(booking.defect_image).split(";").filter(Boolean)}
              {#if defectImages.length > 0}
                <div class="flex gap-2 mt-2 flex-wrap">
                  {#each defectImages as imgUrl}
                    <button
                      type="button"
                      class="cursor-pointer hover:opacity-80 transition"
                      on:click={() => onPreview({ image: booking.defect_image }, imgUrl)}
                    >
                      <img src={imgUrl} alt="Defect" class="w-12 h-12 rounded border border-red-300 object-cover" />
                    </button>
                  {/each}
                </div>
              {/if}
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <div class="text-sm text-gray-600">No bookings</div>
{/if}
