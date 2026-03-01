<script>
  import { createEventDispatcher } from "svelte";
  import DefectImagesUploader from "./defectImagesUploader.svelte";

  const dispatch = createEventDispatcher();

  export let isOpen = false;
  export let selectedBookingId = null;

  let defectReport = "";
  let defectImages = [];
  let defectImageInput = null;

  $: if (isOpen) {
    defectReport = "";
    defectImages = [];
  }

  function closeModal() {
    isOpen = false;
  }

  async function submitDefectReport() {
    if (!selectedBookingId || !defectReport.trim()) {
      alert("Please provide a defect report description");
      return;
    }

    if (!defectImages || defectImages.length === 0) {
      alert("Please upload at least one photo of the defect");
      return;
    }

    dispatch("reportDefect", {
      bookingId: selectedBookingId,
      defectReport,
      defectImages
    });
    
    closeModal();
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-lg p-10 w-[95vw] max-h-[80vh] overflow-y-auto">
      <h2 class="text-3xl font-semibold mb-8">Report Defect</h2>
      
      <div class="mb-8">
        <label for="defect-description" class="block text-base font-semibold mb-3">Defect Description</label>
        <textarea
          id="defect-description"
          class="w-full border rounded p-4 text-base"
          placeholder="Describe the defect in detail..."
          rows="5"
          bind:value={defectReport}
        ></textarea>
      </div>

      <div class="mb-10">
        <DefectImagesUploader bind:defectImages bind:defectImageInput />
      </div>

      <div class="flex gap-4 justify-end">
        <button class="bg-gray-300 text-gray-800 px-8 py-3 rounded text-base" on:click={closeModal}>Cancel</button>
        <button class="bg-orange-600 text-white px-8 py-3 rounded text-base" on:click={submitDefectReport}>Report Defect</button>
      </div>
    </div>
  </div>
{/if}
