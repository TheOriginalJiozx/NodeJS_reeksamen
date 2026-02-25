<script>
  import { onMount, onDestroy } from "svelte";
  import flatpickr from "flatpickr";
  import "flatpickr/dist/flatpickr.min.css";
  import { fetchAvailability } from "../../fetchers/bookingFetchers.js";
  import apiFetch from "../../lib/api.js";
  import { handleAddAvailability } from "../../handlers/bookingHandlers.js";
  import notifier from "../../lib/notifier.js";
  import { today, contiguousEndDates } from "../../utils/bookingUtils.js";
  import logger from "../../lib/logger.js";
  import { getCachedUser } from "../../utils/authUtils.js";
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
      const fullDate = `${year}-${month}-${day}`;
      if (!availableDates.includes(fullDate)) out.push(fullDate);
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
        logger.error("Failed to clear end date picker",
          error && error.message ? error.message : error,
        );
      }
    }
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
      logger.error("Failed to fetch owned resources", error && error.message ? error.message : error);
    }
    if (resourcesOwned.length && !available.resourceId) available.resourceId = resourcesOwned[0].id;
    if (available.resourceId) await load(available.resourceId);

    startFlatPickr = flatpickr(startElement, {
      dateFormat: "Y-m-d",
      enable: ownerAvailable,
      minDate: today,
      onChange: (_selectedDates, dateString) => (available.startDate = dateString || ""),
    });

    endFlatPickr = flatpickr(endElement, {
      dateFormat: "Y-m-d",
      enable: availableEndOptions,
      minDate: available.startDate || today,
      onChange: (_selectedDates, dateString) => (available.endDate = dateString || ""),
    });

    try {
      if (typeof globalThis.io === "function") {
        socket = globalThis.io(BACKEND_ORIGIN, { withCredentials: true });
        socket.on("resource:created", async () => {
          try {
            const cached = getCachedUser();
            const userId = cached?.id;
            if (userId) {
              const res = await apiFetch(`/api/users/${userId}/resources`);
              if (res.ok) resourcesOwned = await res.json();
            }
          } catch (error) {
            logger.error("Failed to fetch owned resources", error && error.message ? error.message : error);
          }
          if (resourcesOwned.length && !available.resourceId) available.resourceId = resourcesOwned[0].id;
          if (available.resourceId) await load(available.resourceId);
        });
        socket.on("resource:deleted", async () => {
          try {
            const cached = getCachedUser();
            const userId = cached?.id;
            if (userId) {
              const res = await apiFetch(`/api/users/${userId}/resources`);
              if (res.ok) resourcesOwned = await res.json();
            }
          } catch (error) {
            logger.error("Failed to fetch owned resources", error && error.message ? error.message : error);
          }
          if (resourcesOwned.length && !available.resourceId) available.resourceId = resourcesOwned[0].id;
          if (available.resourceId) await load(available.resourceId);
        });
        socket.on("availability:changed", async (payload) => {
          try {
            if (payload && String(payload.resourceId) === String(available.resourceId)) await load(available.resourceId);
          } catch (error) {
            logger.error("Failed to handle availability change event",
              error && error.message ? error.message : error,
            );
          }
        });
      }
    } catch (error) {
      logger.warn(
        "socket setup in addAvailability failed",
        error && error.message ? error.message : error,
      );
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
      logger.warn("Failed to clean up socket in addAvailability", error && error.message ? error.message : error);
    }
  });

  $: if (available.resourceId) load(available.resourceId);

  async function add() {
    if (!available.startDate || !available.endDate) {
      notifier.error("Select both start and end dates");
      return;
    }

    const res = await handleAddAvailability(available);
    if (res && res.ok) {
      const id = available.resourceId;
      try {
        if (startFlatPickr) startFlatPickr.clear();
      } catch (error) {
        logger.debug("Failed to clear startFlatPickr", error && error.message ? error.message : error);
      }
      try {
        if (endFlatPickr) endFlatPickr.clear();
      } catch (error) {
        logger.debug("Failed to clear endFlatPickr", error && error.message ? error.message : error);
      }
      available = { resourceId: id, startDate: "", endDate: "" };
      await load(id);
    }
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
    <button class="bg-green-600 text-white px-4 py-2 rounded" on:click|preventDefault={add}>Add</button>
  </div>
</section>
