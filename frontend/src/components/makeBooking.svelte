<script>
  import { onMount, onDestroy } from "svelte";
  import flatpickr from "flatpickr";
  import "flatpickr/dist/flatpickr.min.css";
  import { fetchAllResources, fetchAvailability } from "../fetcher/bookingFetchers.js";
  import { handleBooking } from "../handler/bookingHandlers.js";
  import notifier from "../lib/notifier.js";
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
  let previewImage = null;
  let previewImages = [];
  let previewIndex = 0;

  function openPreviewFromSelected(image) {
    previewImages = selectedImages.slice();
    previewIndex = previewImages.indexOf(image);
    if (previewIndex === -1) previewIndex = 0;
    previewImage = previewImages[previewIndex] || null;
  }

  function onPreviewKey(event) {
    if (!previewImage || !previewImages || !previewImages.length) return;
    if (event.key === "ArrowRight") {
      previewIndex = (previewIndex + 1) % previewImages.length;
      previewImage = previewImages[previewIndex];
    } else if (event.key === "ArrowLeft") {
      previewIndex = (previewIndex - 1 + previewImages.length) % previewImages.length;
      previewImage = previewImages[previewIndex];
    } else if (event.key === "Escape") {
      previewImage = null;
    }
  }

  $: if (previewImage) {
    window.addEventListener("keydown", onPreviewKey);
  } else {
    window.removeEventListener("keydown", onPreviewKey);
  }

  onDestroy(() => {
    window.removeEventListener("keydown", onPreviewKey);
  });

  $: selectedResource = resourcesAll.find(
    (resource) => String(resource.id) === String(booking.resourceId),
  );
  
  $: selectedImages = selectedResource && selectedResource.image ? String(selectedResource.image).split(";").filter(Boolean) : [];

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
        logger.error("Failed to clear end date picker",
          error && error.message ? error.message : error,
        );
      }
    }
  }

  onMount(async () => {
    resourcesAll = (await fetchAllResources()).resourcesAll || [];
    if (resourcesAll.length && !booking.resourceId) booking.resourceId = resourcesAll[0].id;
    if (booking.resourceId) await load(booking.resourceId);

    startFlatPickr = flatpickr(startElement, {
      dateFormat: "Y-m-d",
      enable: availableDates,
      minDate: today,
      onChange: (_selectedDates, dateStr) => (booking.startDate = dateStr || ""),
    });
    endFlatPickr = flatpickr(endElement, {
      dateFormat: "Y-m-d",
      enable: bookingEndOptions,
      minDate: booking.startDate || today,
      onChange: (_selectedDates, dateString) => (booking.endDate = dateString || ""),
    });
  });

  onDestroy(() => {
    if (startFlatPickr) startFlatPickr.destroy();
    if (endFlatPickr) endFlatPickr.destroy();
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
    {#if selectedImages.length}
      <div class="mt-2">
        <div class="flex items-center gap-3 mb-2">
          <div class="text-sm text-gray-600">Click on images to preview</div>
          <div class="text-xs text-gray-600">(use left and right arrows to change)</div>
        </div>
        <div class="flex items-center gap-3">
        {#each selectedImages.slice(0,3) as image}
          <div class="relative inline-block">
            <button type="button" class="p-0" on:click={() => openPreviewFromSelected(image)} aria-label="Preview image">
              <img src={image} alt={selectedResource.name} class="h-12 rounded border" />
            </button>
          </div>
        {/each}
        {#if selectedImages.length > 3}
          <div class="text-sm text-gray-600">+{selectedImages.length - 3}</div>
        {/if}
        </div>
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
    <input class="w-full border rounded p-2" placeholder="Comment" bind:value={booking.comment} />
    <button class="bg-blue-600 text-white px-4 py-2 rounded" on:click|preventDefault={book}>Book</button>
  </div>
  </section>
</div>

{#if previewImage}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div
      class="absolute inset-0 bg-black/60"
      role="button"
      tabindex="0"
      on:click={() => (previewImage = null)}
      on:keydown={(event) => {
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          previewImage = null;
          event.preventDefault();
        }
      }}
    ></div>
    <img src={previewImage} alt="Preview" class="max-w-[90vw] max-h-[90vh] rounded shadow-lg z-50" />
    <button class="absolute top-4 right-4 bg-white text-gray-800 rounded-full p-2 z-60" on:click={() => (previewImage = null)}>✕</button>
  </div>
{/if}
