<script>
  import flatpickr from "flatpickr";
  import "flatpickr/dist/flatpickr.min.css";
  import logger from "../../lib/logger.js";
  import { today, contiguousEndDates } from "../../utils/bookingUtils.js";

  export let booking = { startDate: "", endDate: "" };
  export let availableDates = [];

  let startElement;
  let endElement;
  let startFlatPickr;
  let endFlatPickr;

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

  function initializePickrs() {
    startFlatPickr = flatpickr(startElement, {
      dateFormat: "Y-m-d",
      enable: availableDates,
      minDate: today,
      onChange: (_selectedDates, dateString) => (booking.startDate = dateString || ""),
    });
    endFlatPickr = flatpickr(endElement, {
      dateFormat: "Y-m-d",
      enable: bookingEndOptions,
      minDate: booking.startDate || today,
      onChange: (_selectedDates, dateString) => (booking.endDate = dateString || ""),
    });
  }

  function cleanupPickrs() {
    if (startFlatPickr) startFlatPickr.destroy();
    if (endFlatPickr) endFlatPickr.destroy();
  }

  import { onMount, onDestroy } from "svelte";

  onMount(initializePickrs);
  onDestroy(cleanupPickrs);
</script>

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
