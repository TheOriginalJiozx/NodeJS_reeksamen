<script>
  import { onMount, onDestroy } from "svelte";
  import "flatpickr/dist/flatpickr.min.css";
  import { apiFetch } from "../../lib/api.js";
  import { handleAddAvailability } from "../../handlers/bookingHandlers.js";
  import notifier from "../../lib/notifier.js";
  import { today, contiguousEndDates, computeOwnerAvailable } from "../../utils/bookingUtils.js";
  import logger from "../../lib/logger.js";
  import { getCachedUser } from "../../lib/auth.js";
  import { setupNavbarSocket } from "../../utils/navbarSocketUtils.js";
  import { setupDatePickers, updateEndDatePicker } from "../../utils/datePickerUtils.js";
  import { loadAvailability, submitAvailability } from "../../handlers/availabilityHandlers.js";

  const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || window.location.origin;
  
  let resourcesOwned = [];
  let available = { resourceId: "", startDate: "", endDate: "" };
  let availability = [];
  let availableDates = [];
  let socket = null;

  let startElement;
  let endElement;
  let startFlatPickr;
  let endFlatPickr;

  async function load(id) {
    const data = await loadAvailability(id);
    availability = data.availability;
    availableDates = data.availableDates;
  }

  $: ownerAvailable = computeOwnerAvailable(availableDates);
  $: availableEndOptions = available.startDate
    ? contiguousEndDates(available.startDate, ownerAvailable)
    : ownerAvailable;

  $: if (startFlatPickr) {
    startFlatPickr.set("enable", ownerAvailable);
    startFlatPickr.set("minDate", today);
  }
  $: if (endFlatPickr) {
    updateEndDatePicker(
      endFlatPickr,
      availableEndOptions,
      available.startDate,
      today,
      available.endDate,
      () => { available.endDate = ""; }
    );
  }

  onMount(async () => {
    try {
      const cached = getCachedUser();
      const userId = cached?.id;
      if (userId) {
        const res = await apiFetch(`/api/users/${userId}/resources`);
        if (res.ok) resourcesOwned = await res.json();
        else notifier.error("Failed to fetch your resources");
      }
    } catch (error) {
      notifier.error("Failed to fetch your resources");
      logger.error("Failed to fetch owned resources", error?.message || error);
    }
    if (resourcesOwned.length && !available.resourceId) available.resourceId = resourcesOwned[0].id;
    if (available.resourceId) await load(available.resourceId);

    const result = setupDatePickers(
      startElement,
      endElement,
      today,
      ownerAvailable,
      availableEndOptions,
      {
        onStartDateChange: (dateString) => { available.startDate = dateString; },
        onEndDateChange: (dateString) => { available.endDate = dateString; },
      }
    );
    startFlatPickr = result.startFlatPickr;
    endFlatPickr = result.endFlatPickr;

    try {
      if (typeof globalThis.io === "function") {
        socket = setupNavbarSocket(globalThis.io, BACKEND_ORIGIN, "", {
          onResourcesUpdate: (resources) => {
            resourcesOwned = resources;
            if (resourcesOwned.length && !available.resourceId) available.resourceId = resourcesOwned[0].id;
            if (available.resourceId) load(available.resourceId);
          },
          onAvailabilityUpdate: (resourceId) => {
            if (String(resourceId) === String(available.resourceId)) load(available.resourceId);
          },
        });
      }
    } catch (error) {
      logger.warn("socket setup in addAvailability failed", error?.message || error);
    }
  });

  onDestroy(() => {
    if (startFlatPickr) startFlatPickr.destroy();
    if (endFlatPickr) endFlatPickr.destroy();
    try {
      if (socket) {
        socket.removeAllListeners && socket.removeAllListeners();
        socket.disconnect && socket.disconnect();
      }
    } catch (error) {
      logger.warn("Failed to clean up socket in addAvailability", error?.message || error);
    }
  });

  $: if (available.resourceId) load(available.resourceId);

  async function add() {
    const submitRes = await submitAvailability(available, handleAddAvailability);
    if (!submitRes.ok) {
      notifier.error(submitRes.message || "Failed to add availability");
      return;
    }

    const id = available.resourceId;
    try {
      startFlatPickr?.clear();
      if (startElement) startElement.value = "";
    } catch (error) {
      logger.debug("Failed to clear startFlatPickr", error?.message || error);
    }
    try {
      endFlatPickr?.clear();
      if (endElement) endElement.value = "";
    } catch (error) {
      logger.debug("Failed to clear endFlatPickr", error?.message || error);
    }
    available = { resourceId: id, startDate: "", endDate: "" };
    await load(id);
  }
</script>

<section class="bg-white p-4 rounded shadow">
  <h2 class="font-semibold mb-2">Add Availability</h2>
  <div class="space-y-2">
    <select
      class="w-full border rounded p-2"
      bind:value={available.resourceId}
      on:change={() => load(available.resourceId)}
    >
      {#each resourcesOwned as resource (resource.id)}
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
    <button class="bg-green-600 text-white px-4 py-2 rounded" on:click|preventDefault={add}>Add</button>
  </div>
</section>
