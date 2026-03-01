<script>
  import { onMount, onDestroy } from "svelte";
  import { navigate, route } from "../lib/router.js";
  import { apiFetch } from "../lib/api.js";
  import notifier from "../lib/notifier.js";
  import logger from "../lib/logger.js";
  import { loadExistingNotifications } from "../handlers/notificationHandlers.js";
  import ResourceTable from "../components/resources/resourceTable.svelte";
  import { setupNavbarSocket, disconnectSocket, joinResourceRoom } from "../utils/navbarSocketUtils.js";
  import { loadResourcesWithBookingsAndAvailability, confirmBooking, declineBooking, deleteResource, deleteAvailability } from "../handlers/resourceHandlers.js";
  import { loadAuthenticatedUser } from "../lib/auth.js";

  const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || window.location.origin;

  let loading = true;
  let user = null;
  let resources = [];
  let resourceBookings = {};
  let resourceAvailabilities = {};
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
    try {
      const { resources: res, resourceBookings: newBookings, resourceAvailabilities: newAvailabilities } = await loadResourcesWithBookingsAndAvailability(user?.id);
      resources = res;
      resourceBookings = newBookings;
      resourceAvailabilities = newAvailabilities;
      
      if (socket) {
        resources.forEach((resource) => {
          joinResourceRoom(socket, resource.id);
        });
      }
    } catch (error) {
      logger.error("[fetchResources] Error:", error?.message || error);
      throw error;
    }
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

  async function handleDeleteResource(id, isDefect) {
    const res = await deleteResource(id, isDefect);
    if (res.ok) {
      notifier.success("Resource deleted");
      if (isDefect) {
        window.location.reload();
      } else {
        await fetchResources();
        if (user?.id) {
          await loadExistingNotifications(user.id);
        }
      }
    } else {
      notifier.error(res.message || "Failed to delete resource");
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
      const parsed = loadAuthenticatedUser();
      if (!parsed?.id) return navigate("/login");
      const userResponse = await apiFetch(`/api/users/${parsed.id}`, { credentials: "include" });
      if (userResponse.status === 401) return navigate("/login");
      user = (await userResponse.json()).user || null;
      await fetchResources();

      socket = setupNavbarSocket(globalThis.io, BACKEND_ORIGIN, user?.fullname, {
        onBookingChange: fetchResources,
      });
    } catch (error) {
      notifier.error("Failed to load resources");
      logger.error("Failed to fetch user or resources", error?.message || error);
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
