<script>
  import { onMount } from "svelte";
  import { fetchAllResources, fetchAvailability } from "../../fetcher/bookingFetchers.js";
  import { handleBooking } from "../../handler/bookingHandlers.js";
  import notifier from "../../lib/notifier.js";
  import BookingDatePicker from "./bookingDatePicker.svelte";
  import BookingImagePreview from "./bookingImagePreview.svelte";

  let resourcesAll = [];

  let booking = {
    resourceId: "",
    startDate: "",
    endDate: "",
    booker: "",
    comment: "",
  };

  let availableDates = [];

  $: selectedResource = resourcesAll.find(
    (resource) => String(resource.id) === String(booking.resourceId),
  );

  $: selectedImages = selectedResource && selectedResource.image ? String(selectedResource.image).split(";").filter(Boolean) : [];

  async function load(id) {
    if (!id) {
      availableDates = [];
      return;
    }
    const fetch = await fetchAvailability(id);
    availableDates = fetch.availableDates || [];
  }

  onMount(async () => {
    resourcesAll = (await fetchAllResources()).resourcesAll || [];
    if (resourcesAll.length && !booking.resourceId) booking.resourceId = resourcesAll[0].id;
    if (booking.resourceId) await load(booking.resourceId);
  });

  $: if (booking.resourceId) load(booking.resourceId);

  async function book() {
    if (!booking.resourceId || !booking.startDate || !booking.endDate) {
      notifier.error("Select resource and dates");
      return;
    }
    const res = await handleBooking(booking);
    if (res && res.ok) {
      booking = {
        resourceId: booking.resourceId,
        startDate: "",
        endDate: "",
        booker: "",
        comment: "",
      };
      await load(booking.resourceId);
    }
  }
</script>

<div class="min-w-screen flex items-center justify-center">
  <section class="max-w-xl mx-auto bg-white p-4 rounded shadow">
    <h2 class="font-semibold mb-2">Make a booking</h2>
    <div class="space-y-2">
      <select
        class="w-full border rounded p-2"
        bind:value={booking.resourceId}
        on:change={() => load(booking.resourceId)}
      >
        {#each resourcesAll as resource}
          <option value={resource.id}>{resource.name} ({resource.type})</option>
        {/each}
      </select>
      {#if selectedResource && selectedResource.owner}
        <div class="text-sm text-gray-600">Owner: {selectedResource.owner}</div>
      {/if}
      <BookingImagePreview images={selectedImages} resourceName={selectedResource?.name} />
      <BookingDatePicker {booking} {availableDates} />
      <input class="w-full border rounded p-2" placeholder="Comment" bind:value={booking.comment} />
      <button class="bg-blue-600 text-white px-4 py-2 rounded" on:click|preventDefault={book}>Book</button>
    </div>
  </section>
</div>
