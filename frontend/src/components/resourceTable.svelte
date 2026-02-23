<script>
  import BookingList from "./bookingList.svelte";
  import ResourceImages from "./resourceImages.svelte";
  import AvailabilitiesList from "./availabilitiesList.svelte";

  export let resources = [];
  export let resourceBookings = {};
  export let resourceAvailabilities = {};
  export let onPreview = () => {};
  export let onDeleteResource = async () => {};
  export let onConfirmBooking = async () => {};
  export let onDeclineBooking = async () => {};
  export let onDeleteAvailability = async () => {};
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
          <button class="bg-red-600 text-white px-2 py-1 rounded" on:click={() => onDeleteResource(resource.id)}>Delete</button>
        </td>
      </tr>
      <tr>
        <td colspan="4" class="bg-gray-50 px-4 py-2">
          <AvailabilitiesList resourceId={resource.id} availabilities={resourceAvailabilities[String(resource.id)]} onDelete={onDeleteAvailability} />
          <div class="text-sm font-semibold mb-2">Bookings</div>
          <BookingList bookings={resourceBookings[String(resource.id)]} confirm={onConfirmBooking} decline={onDeclineBooking} />
        </td>
      </tr>
    {/each}
  </tbody>
</table>
