<script>
  import { fetchAvailability } from "../../fetchers/bookingFetchers.js";
  import notifier from "../../lib/notifier.js";

  export let resourceId = null;
  export let availabilities = [];
  export let onDelete = async () => {};

  let editModalOpen = false;
  let selectedAvailability = null;
  let editStartDate = "";
  let editEndDate = "";

  async function handleDelete(availabilityId) {
    if (!resourceId || !availabilityId) {
      notifier.error("Invalid resource or availability ID");
      return;
    }
    
    const availability = availabilities.find(a => (a.id || a.insertId) === availabilityId);
    if (!availability) {
      notifier.error("Availability not found in this resource");
      return;
    }
    
    const result = await onDelete(resourceId, availabilityId);
    if (result === false) return;
    try {
      availabilities = (await fetchAvailability(resourceId)).availability || [];
    } catch (error) {
      notifier.error("Failed to refresh availabilities");
    }
  }

  function openEditModal(availability) {
    selectedAvailability = availability;
    editStartDate = availability.startDate;
    editEndDate = availability.endDate;
    editModalOpen = true;
  }

  function closeEditModal() {
    editModalOpen = false;
    selectedAvailability = null;
    editStartDate = "";
    editEndDate = "";
  }

  async function submitEdit() {
    if (!selectedAvailability || !editStartDate || !editEndDate) {
      notifier.error("Missing date fields");
      return;
    }

    try {
      const availabilityId = selectedAvailability.id || selectedAvailability.insertId;
      const response = await fetch(`/api/resources/${resourceId}/availabilities/${availabilityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: editStartDate, endDate: editEndDate }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        notifier.error(data.message || "Failed to update availability");
        return;
      }

      notifier.success("Availability updated");
      closeEditModal();
      
      try {
        availabilities = (await fetchAvailability(resourceId)).availability || [];
      } catch (error) {
        notifier.error("Failed to refresh availabilities");
      }
    } catch (error) {
      notifier.error("Error updating availability");
    }
  }
</script>

<div class="text-sm font-semibold mb-2">Availabilities</div>
{#if Array.isArray(availabilities) && availabilities.length > 0}
  <ul class="text-sm space-y-1 mb-3">
    {#each availabilities as available (available.id || available.insertId)}
      <li class="flex items-center justify-between">
        <div>{available.startDate} — {available.endDate}</div>
        <div class="space-x-2">
          <button class="bg-blue-600 text-white px-2 py-1 rounded text-xs" on:click={() => openEditModal(available)}>Edit</button>
          <button class="bg-red-600 text-white px-2 py-1 rounded text-xs" on:click={() => handleDelete(available.id || available.insertId)}>Delete</button>
        </div>
      </li>
    {/each}
  </ul>
{:else}
  <div class="text-xs text-gray-600 mb-3">No availabilities</div>
{/if}

{#if editModalOpen && selectedAvailability}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <h2 class="text-xl font-semibold mb-4">Edit Availability</h2>
      
      <div class="mb-4">
        <label for="edit-start-date" class="block text-sm font-semibold mb-2">Start Date</label>
        <input
          id="edit-start-date"
          type="date"
          class="w-full border rounded p-2"
          bind:value={editStartDate}
        />
      </div>

      <div class="mb-6">
        <label for="edit-end-date" class="block text-sm font-semibold mb-2">End Date</label>
        <input
          id="edit-end-date"
          type="date"
          class="w-full border rounded p-2"
          bind:value={editEndDate}
        />
      </div>

      <div class="flex gap-2 justify-end">
        <button class="bg-gray-300 text-gray-800 px-4 py-2 rounded" on:click={closeEditModal}>Cancel</button>
        <button class="bg-blue-600 text-white px-4 py-2 rounded" on:click={submitEdit}>Update</button>
      </div>
    </div>
  </div>
{/if}
