<script>
  import CreateResource from '../components/createResource.svelte';
  import AddAvailability from '../components/addAvailability.svelte';
  import MakeBooking from '../components/makeBooking.svelte';
</script>

<div class="grid gap-4 md:grid-cols-2">
  <CreateResource />
  <AddAvailability />
  <MakeBooking />
</div>
