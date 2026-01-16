<script>
  import { onMount, onDestroy } from "svelte";
  import flatpickr from "flatpickr";
  import "flatpickr/dist/flatpickr.min.css";
  import {
    fetchOwnedResources,
    fetchAvailability,
  } from "../fetcher/bookingFetchers.js";
  import { handleAddAvailability } from "../handler/bookingHandlers.js";
  import { toast } from "../store/toastStore.js";
  import { today, contiguousEndDates } from "../util/bookingUtils.js";
  import logger from "../lib/logger.js";
  
  let resourcesOwned = [];
  let available = { resourceId: "", startDate: "", endDate: "" };
  let availability = [];
  let availableDates = [];

  let startElement;
  let endElement;
  let startFlatPickr;
  let endFlatPickr;

  async function load(id) {
    if (!id) {
      availability = [];
      availableDates = [];
      return;
    }
    const fetch = await fetchAvailability(id);
    availability = fetch.availability || [];
    availableDates = fetch.availableDates || [];
  }

  function computeOwnerAvailable() {
    const out = [];
    for (let i = 0; i < 365; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const ymd = `${year}-${month}-${day}`;
      if (!availableDates.includes(ymd)) out.push(ymd);
    }
    return out;
  }

  $: ownerAvailable = computeOwnerAvailable();
  $: availableEndOptions = available.startDate
    ? contiguousEndDates(available.startDate, ownerAvailable)
    : ownerAvailable;

  $: if (startFlatPickr) {
    startFlatPickr.set("enable", ownerAvailable);
    startFlatPickr.set("minDate", today);
  }
  $: if (endFlatPickr) {
    endFlatPickr.set("enable", availableEndOptions);
    endFlatPickr.set("minDate", available.startDate || today);
    if (available.endDate && !availableEndOptions.includes(available.endDate)) {
      available.endDate = "";
      try {
        endFlatPickr.clear();
      } catch (error) {
        logger.error("Failed to clear end date picker", error && error.message ? error.message : error);
      }
    }
  }

  onMount(async () => {
    resourcesOwned = await fetchOwnedResources();
    if (resourcesOwned.length && !available.resourceId)
      available.resourceId = resourcesOwned[0].id;
    if (available.resourceId) await load(available.resourceId);

    startFlatPickr = flatpickr(startElement, {
      dateFormat: "Y-m-d",
      enable: ownerAvailable,
      minDate: today,
      onChange: (selectedDates, dateString) => (available.startDate = dateString || ""),
    });
    endFlatPickr = flatpickr(endElement, {
      dateFormat: "Y-m-d",
      enable: availableEndOptions,
      minDate: available.startDate || today,
      onChange: (selectedDates, dateString) => (available.endDate = dateString || ""),
    });
  });

  onDestroy(() => {
    if (startFlatPickr) startFlatPickr.destroy();
    if (endFlatPickr) endFlatPickr.destroy();
  });

  $: if (available.resourceId) load(available.resourceId);

  async function add() {
    if (!available.startDate || !available.endDate) {
      toast("Select both start and end dates", "error");
      return;
    }
    const res = await handleAddAvailability(available);
    if (res && res.ok) {
      toast("Availability added", "success");
      const id = available.resourceId;
      available = { resourceId: id, startDate: "", endDate: "" };
      await load(id);
    }
  }
</script>

<section class="bg-white p-4 rounded shadow">
  <h2 class="font-semibold mb-2">Add availability</h2>
  <div class="space-y-2">
    <select
      class="w-full border rounded p-2"
      bind:value={available.resourceId}
      on:change={() => load(available.resourceId)}
    >
      {#each resourcesOwned as resource}
        <option value={resource.id}>{resource.name} ({resource.type})</option>
      {/each}
    </select>
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
    <button
      class="bg-green-600 text-white px-4 py-2 rounded"
      on:click|preventDefault={add}>Add</button
    >
  </div>
</section>
