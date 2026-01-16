<script>
  import { onMount, onDestroy } from "svelte";
  import flatpickr from "flatpickr";
  import "flatpickr/dist/flatpickr.min.css";
  import {
    fetchAllResources,
    fetchAvailability,
  } from "../fetcher/bookingFetchers.js";
  import { handleBooking } from "../handler/bookingHandlers.js";
  import { toast } from "../store/toastStore.js";
  import { today, contiguousEndDates } from "../util/bookingUtils.js";
  import logger from "../lib/logger.js";

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

  let startElement;
  let endElement;
  let startFlatPickr;
  let endFlatPickr;

  async function load(id) {
    if (!id) {
      availableDates = [];
      return;
    }
    const fetch = await fetchAvailability(id);
    availableDates = fetch.availableDates || [];
  }

  $: bookingEndOptions = booking.startDate
    ? contiguousEndDates(booking.startDate, availableDates)
    : availableDates;
  $: if (startFlatPickr) {
    startFlatPickr.set("enable", availableDates || []);
    startFlatPickr.set("minDate", today);
  }
  $: if (endFlatPickr) {
    endFlatPickr.set("enable", bookingEndOptions || []);
    endFlatPickr.set("minDate", booking.startDate || today);
    if (booking.endDate && !bookingEndOptions.includes(booking.endDate)) {
      booking.endDate = "";
      try {
        endFlatPickr.clear();
      } catch (error) {
        logger.error("Failed to clear end date picker", error && error.message ? error.message : error);
      }
    }
  }

  onMount(async () => {
    resourcesAll = (await fetchAllResources()).resourcesAll || [];
    if (resourcesAll.length && !booking.resourceId)
      booking.resourceId = resourcesAll[0].id;
    if (booking.resourceId) await load(booking.resourceId);

    startFlatPickr = flatpickr(startElement, {
      dateFormat: "Y-m-d",
      enable: availableDates,
      minDate: today,
      onChange: (selectedDates, dateString) => (booking.startDate = dateString || ""),
    });
    endFlatPickr = flatpickr(endElement, {
      dateFormat: "Y-m-d",
      enable: bookingEndOptions,
      minDate: booking.startDate || today,
      onChange: (selectedDates, dateString) => (booking.endDate = dateString || ""),
    });
  });

  onDestroy(() => {
    if (startFlatPickr) startFlatPickr.destroy();
    if (endFlatPickr) endFlatPickr.destroy();
  });

  $: if (booking.resourceId) load(booking.resourceId);

  async function book() {
    if (!booking.resourceId || !booking.startDate || !booking.endDate) {
      toast("Select resource and dates", "error");
      return;
    }
    const res = await handleBooking(booking);
    if (res && res.ok) {
      toast("Booked", "success");
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

<section class="bg-white p-4 rounded shadow">
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
    {#if selectedResource && selectedResource.image}
      <div class="mt-2 flex items-center gap-3">
        <button
          type="button"
          class="bg-gray-200 text-gray-800 px-3 py-1 rounded"
          aria-label="Preview image"
          on:click={() =>
            window.open(selectedResource.image, "_blank", "noopener")}
          >Preview image</button
        >
        <img
          src={selectedResource.image}
          alt={selectedResource.name}
          class="h-12 rounded border"
        />
      </div>
    {/if}
    <div class="grid grid-cols-2 gap-2">
      <input
        type="text"
        class="border rounded p-2"
        bind:this={startElement}
        readonly
        placeholder="Start date"
      />
      <input
        type="text"
        class="border rounded p-2"
        bind:this={endElement}
        readonly
        placeholder="End date"
      />
    </div>
    <input
      class="w-full border rounded p-2"
      placeholder="Comment"
      bind:value={booking.comment}
    />
    <button
      class="bg-blue-600 text-white px-4 py-2 rounded"
      on:click|preventDefault={book}>Book</button
    >
  </div>
</section>
