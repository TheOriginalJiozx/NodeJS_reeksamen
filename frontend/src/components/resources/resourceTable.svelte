<script>
  import BookingList from "../bookings/bookingList.svelte";
  import ResourceImages from "./resourceImages.svelte";
  import AvailabilitiesList from "../availabilities/availabilitiesList.svelte";

  export let resources = [];
  export let resourceBookings = {};
  export let resourceAvailabilities = {};
  export let onPreview = () => {};
  export let onDeleteResource = async () => {};
  export let onConfirmBooking = async () => {};
  export let onDeclineBooking = async () => {};
  export let onDeleteAvailability = async () => {};

  let deleteModalOpen = false;
  let selectedResourceId = null;
  let isDefect = false;

  function openDeleteModal(resourceId) {
    selectedResourceId = resourceId;
    isDefect = false;
    deleteModalOpen = true;
  }

  function closeDeleteModal() {
    deleteModalOpen = false;
    selectedResourceId = null;
    isDefect = false;
  }

  async function confirmDelete() {
    if (selectedResourceId !== null) {
      await onDeleteResource(selectedResourceId, isDefect);
      closeDeleteModal();
    }
  }
</script>

<table class="w-full text-left border-collapse">
  <thead>
    <tr class="text-sm text-gray-600 border-b">
      <th class="py-2">Name</th>
      <th class="py-2">Type</th>
      <th class="py-2">Image(s)</th>
    </tr>
  </thead>
  <tbody>
    {#each resources as resource}
      <tr class="align-top border-b">
        <td class="py-2">{resource.name}</td>
        <td class="py-2">{resource.type}</td>
        <td class="py-2">
          <ResourceImages imagesString={resource.image} {resource} open={onPreview} />
        </td>
        <td class="py-2">
          <button class="bg-red-600 text-white px-2 py-1 rounded" on:click={() => openDeleteModal(resource.id)}>Delete</button>
        </td>
      </tr>
      <tr>
        <td colspan="4" class="bg-gray-50 px-4 py-2">
          <AvailabilitiesList resourceId={resource.id} availabilities={resourceAvailabilities[String(resource.id)]} onDelete={onDeleteAvailability} />
          <div class="text-sm font-semibold mb-2">Bookings</div>
          <BookingList bookings={resourceBookings[String(resource.id)]} confirm={onConfirmBooking} decline={onDeclineBooking} onPreview={onPreview} />
        </td>
      </tr>
    {/each}
  </tbody>
</table>

{#if deleteModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <h2 class="text-xl font-semibold mb-4">Delete Resource</h2>
      <p class="text-gray-700 mb-4">Are you sure you want to delete this resource?</p>
      
      <div class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" bind:checked={isDefect} class="w-4 h-4" />
          <span class="text-sm text-gray-700">Mark as defect (allows deletion even with active bookings)</span>
        </label>
      </div>

      <div class="flex gap-2 justify-end">
        <button class="bg-gray-300 text-gray-800 px-4 py-2 rounded" on:click={closeDeleteModal}>Cancel</button>
        <button class="bg-red-600 text-white px-4 py-2 rounded" on:click={confirmDelete}>Delete</button>
      </div>
    </div>
  </div>
{/if}
