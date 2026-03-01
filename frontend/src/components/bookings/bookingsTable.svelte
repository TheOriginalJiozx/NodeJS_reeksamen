<script>
  import { createEventDispatcher } from "svelte";
  import ReportDefectModal from "./reportDefectModal.svelte";

  const dispatch = createEventDispatcher();

  export let bookings = [];
  export let resourceMap = {};

  let reportDefectModalOpen = false;
  let selectedBookingId = null;

  function openReportDefectModal(bookingId) {
    selectedBookingId = bookingId;
    reportDefectModalOpen = true;
  }
</script>

{#if bookings.length === 0}
  <div class="text-gray-600">You have no bookings.</div>
{:else}
  <div class="overflow-x-auto">
    <table class="w-full text-left border-collapse text-sm">
      <thead>
        <tr class="text-xs text-gray-600 border-b bg-gray-50">
          <th class="py-3 px-4">Resource</th>
          <th class="py-3 px-4">Start Date</th>
          <th class="py-3 px-4">End Date</th>
          <th class="py-3 px-4">Confirmation</th>
          <th class="py-3 px-4">Comment</th>
          <th class="py-3 px-4">Images</th>
          <th class="py-3 px-4">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each bookings as booking}
          <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 font-medium">
              {#if resourceMap[String(booking.resourceId)]}
                {resourceMap[String(booking.resourceId)].name}
              {:else}
                Resource {booking.resourceId}
              {/if}
            </td>
            
            <td class="py-3 px-4 text-gray-700">
              {booking.startDate}
            </td>
            
            <td class="py-3 px-4 text-gray-700">
              {booking.endDate || booking.startDate}
            </td>
            
            <td class="py-3 px-4">
              {#if booking.confirmed === 1}
                <span class="text-xs text-green-600 font-semibold">Confirmed</span>
              {:else if booking.confirmed === 2}
                <span class="text-xs text-red-600 font-semibold">Declined</span>
              {:else}
                <span class="text-xs text-gray-600">Pending</span>
              {/if}
            </td>
            
            <td class="py-3 px-4 text-gray-700 max-w-xs truncate">
              {booking.comment || "—"}
            </td>
            
            <td class="py-3 px-4">
              {#if booking.image}
                <div class="flex items-center gap-1">
                  {#each (booking.image ? String(booking.image).split(";").filter(Boolean).slice(0, 2) : []) as image}
                    <button 
                      type="button" 
                      on:click={() => dispatch("openPreview", { imagesString: booking.image, label: resourceMap[String(booking.resourceId)]?.name || "Resource", startIndex: 0 })}
                      class="w-8 h-8 rounded border overflow-hidden cursor-pointer hover:opacity-80"
                      aria-label="Open image preview"
                    >
                      <img src={image} alt="" class="w-full h-full object-cover" />
                    </button>
                  {/each}
                  {#if String(booking.image).split(";").filter(Boolean).length > 2}
                    <span class="text-xs text-gray-600">+{String(booking.image).split(";").filter(Boolean).length - 2}</span>
                  {/if}
                </div>
              {:else if resourceMap[String(booking.resourceId)]?.image}
                <div class="flex items-center gap-1">
                  {#each (resourceMap[String(booking.resourceId)].image ? String(resourceMap[String(booking.resourceId)].image).split(";").filter(Boolean).slice(0, 2) : []) as image}
                    <button 
                      type="button" 
                      on:click={() => dispatch("openPreview", { imagesString: resourceMap[String(booking.resourceId)].image, label: resourceMap[String(booking.resourceId)].name || "Resource", startIndex: 0 })}
                      class="w-8 h-8 rounded border overflow-hidden cursor-pointer hover:opacity-80"
                      aria-label="Open image preview"
                    >
                      <img src={image} alt="" class="w-full h-full object-cover" />
                    </button>
                  {/each}
                  {#if String(resourceMap[String(booking.resourceId)].image).split(";").filter(Boolean).length > 2}
                    <span class="text-xs text-gray-600">+{String(resourceMap[String(booking.resourceId)].image).split(";").filter(Boolean).length - 2}</span>
                  {/if}
                </div>
              {:else}
                <span class="text-gray-400">—</span>
              {/if}
            </td>
            
            <td class="py-3 px-4">
              <div class="flex flex-col gap-2">
                {#if !booking.seen && (booking.confirmed === 1 || booking.confirmed === 2)}
                  <button
                    type="button"
                    class="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 whitespace-nowrap"
                    on:click={() => dispatch("markSeen", { bookingId: booking.id })}
                  >
                    Mark seen
                  </button>
                {/if}
                {#if booking.confirmed === 1}
                  <button
                    type="button"
                    class="bg-orange-600 text-white px-2 py-1 rounded text-xs hover:bg-orange-700 whitespace-nowrap"
                    on:click={() => openReportDefectModal(booking.id)}
                  >
                    Report Defect
                  </button>
                {/if}
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<ReportDefectModal
  isOpen={reportDefectModalOpen}
  {selectedBookingId}
  on:reportDefect={(event) => {
    dispatch("reportDefect", event.detail);
    reportDefectModalOpen = false;
  }}
/>
