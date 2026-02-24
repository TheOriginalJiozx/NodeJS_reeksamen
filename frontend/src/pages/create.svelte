<script>
  import CreateResource from "../components/resources/createResource.svelte";
  import AddAvailability from "../components/availability/addAvailability.svelte";
</script>

<div class="container mx-auto px-4">
  <div class="bg-gray-100 rounded-2xl shadow-xl overflow-hidden">
    <div class="py-4 md:py-6 px-6">
      <div class="grid gap-4 md:grid-cols-2">
        <CreateResource />
        <AddAvailability />
      </div>
    </div>
  </div>
</div>
