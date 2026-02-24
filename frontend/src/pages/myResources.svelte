<script>
  import { onMount, onDestroy } from "svelte";
  import { navigate } from "../lib/router.js";
  import apiFetch from "../lib/api.js";
  import logger from "../lib/logger.js";
  import ResourceTable from "../components/resources/resourceTable.svelte";
  import { initializeResourceSocket, disconnectSocket } from "../lib/socketUtils.js";
  import { confirmBooking, declineBooking, deleteResource, deleteAvailability, loadResourcesWithBookingsAndAvailability } from "../handler/resourceHandlers.js";

  let loading = true;
  let user = null;
  let resources = [];
  let resourceBookings = {};
  let resourceAvailabilities = {};
  let error = null;
  let socket = null;
  let previewImage = null;
  let previewImages = [];
  let previewIndex = 0;

  function openPreviewFromResource(resource, image) {
    previewImages = String(resource.image).split(";").filter(Boolean);
    previewIndex = Math.max(0, previewImages.indexOf(image));
    previewImage = previewImages[previewIndex];
  }

  function onPreviewKey(event) {
    if (!previewImage || !previewImages.length) return;
    if (event.key === "ArrowRight") previewIndex = (previewIndex + 1) % previewImages.length;
    else if (event.key === "ArrowLeft") previewIndex = (previewIndex - 1 + previewImages.length) % previewImages.length;
    else if (event.key === "Escape") previewImage = null;
    previewImage = previewImages[previewIndex];
  }

  async function fetchResources() {
    const { resources: res, resourceBookings: newBookings, resourceAvailabilities: newAvailabilities } = await loadResourcesWithBookingsAndAvailability(user?.id);
    resources = res;
    resourceBookings = newBookings;
    resourceAvailabilities = newAvailabilities;
  }

  async function handleConfirmBooking(bookingId) {
    if (await confirmBooking(bookingId)) {
      await fetchResources();
    }
  }

  async function handleDeclineBooking(bookingId) {
    if (await declineBooking(bookingId)) {
      await fetchResources();
    }
  }

  async function handleDeleteResource(id) {
    const res = await deleteResource(id);
    if (res.ok) {
      resources = resources.filter((resource) => String(resource.id) !== String(id));
    } else {
      error = res.message;
    }
  }

  onMount(() => {
    window.addEventListener("keydown", onPreviewKey);
    return () => window.removeEventListener("keydown", onPreviewKey);
  });

  onDestroy(() => {
    disconnectSocket(socket);
  });

  onMount(async () => {
    try {
      const cached = localStorage.getItem("user");
      const parsed = cached ? JSON.parse(cached) : null;
      if (!parsed?.id) return navigate("/login");
      const me = await apiFetch(`/api/users/${parsed.id}`, { credentials: "include" });
      if (me.status === 401) return navigate("/login");
      user = (await me.json()).user || null;
      await fetchResources();

      const socketUrl = import.meta.env.VITE_BACKEND_ORIGIN || window.location.origin;
      socket = initializeResourceSocket(socketUrl, user?.username, fetchResources);
    } catch (error) {
      logger.error("Failed to fetch user or resources", error && error.message ? error.message : error);
    } finally {
      loading = false;
    }
  });
</script>

<div class="container mx-auto px-4">
  <div class="bg-gray-100 rounded-2xl shadow-xl overflow-hidden">
    <div class="py-4 md:py-12 px-6">
      <section class="max-w-3xl mx-auto mt-8 bg-white rounded shadow p-6">
        <h2 class="text-2xl font-semibold mb-4">My resources</h2>
        <div class="flex items-center gap-3 mb-2">
          <div class="text-sm text-gray-600">Click on images to preview</div>
          <div class="text-xs text-gray-600">(use left and right arrows to change)</div>
        </div>
        {#if loading}
          <div class="text-gray-600">Loading...</div>
        {:else if error}
          <div class="text-red-600">{error}</div>
        {:else if resources.length === 0}
          <div class="text-gray-600">You have no resources.</div>
        {:else}
          <ResourceTable
            {resources}
            {resourceBookings}
            {resourceAvailabilities}
            onPreview={openPreviewFromResource}
            onDeleteResource={handleDeleteResource}
            onConfirmBooking={handleConfirmBooking}
            onDeclineBooking={handleDeclineBooking}
            onDeleteAvailability={deleteAvailability}
          />
        {/if}
      </section>
    </div>
  </div>
</div>

{#if previewImage}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div
      class="absolute inset-0 bg-black/60"
      role="button"
      tabindex="0"
      on:click={() => (previewImage = null)}
      on:keydown={(event) => {
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          previewImage = null;
          event.preventDefault();
        }
      }}
    ></div>
    <img src={previewImage} alt="Preview" class="max-w-[90vw] max-h-[90vh] rounded shadow-lg z-50" />
    <button class="absolute top-4 right-4 bg-white text-gray-800 rounded-full p-2 z-60" on:click={() => (previewImage = null)}>✕</button>
  </div>
{/if}
