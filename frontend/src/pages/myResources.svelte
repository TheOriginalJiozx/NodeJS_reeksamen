<script>
  import { onMount, onDestroy } from "svelte";
  import { navigate } from "../lib/router.js";
  import apiFetch from "../lib/api.js";
  import notifier from "../lib/notifier.js";
  import { removeNotificationsByBookingId } from "../store/notificationsStore.js";
  import BookingList from "../components/bookingList.svelte";
  import ResourceImages from "../components/resourceImages.svelte";

  let loading = true;
  let user = null;
  let resources = [];
  let resourceBookings = {};
  let error = null;
  let socket = null;
  let previewImage = null;
  let previewImages = [];
  let previewIndex = 0;

  function openPreviewFromResource(resource, image) {
    previewImages = String(resource.image || "").split(";").filter(Boolean);
    previewIndex = Math.max(0, previewImages.indexOf(image));
    previewImage = previewImages[previewIndex] || null;
  }

  function onPreviewKey(event) {
    if (!previewImage || !previewImages.length) return;
    if (event.key === "ArrowRight") previewIndex = (previewIndex + 1) % previewImages.length;
    else if (event.key === "ArrowLeft") previewIndex = (previewIndex - 1 + previewImages.length) % previewImages.length;
    else if (event.key === "Escape") previewImage = null;
    previewImage = previewImages[previewIndex];
  }

  onMount(() => {
    window.addEventListener("keydown", onPreviewKey);
    return () => window.removeEventListener("keydown", onPreviewKey);
  });

  onDestroy(() => {
    if (socket?.disconnect) socket.disconnect();
  });

  async function fetchBookingsFor(resourceId) {
    try {
      const res = await apiFetch(`/api/bookings?resourceId=${resourceId}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.bookings) ? data.bookings : data.bookings || [];
    } catch {
      return [];
    }
  }

  async function fetchResources() {
    const res = await apiFetch("/api/resources/mine", { credentials: "include" });
    if (!res.ok) return;
    resources = await res.json();
    const bookingsList = await Promise.all(resources.map((resource) => fetchBookingsFor(resource.id)));
    resourceBookings = {};
    resources.forEach((resource, index) => (resourceBookings[String(resource.id)] = bookingsList[index] || []));
  }

  async function confirmBooking(bookingId, resourceId) {
    const res = await apiFetch(`/api/bookings/${bookingId}/confirm`, { method: "PATCH" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Failed to confirm booking");
      return;
    }
    resourceBookings[String(resourceId)] = await fetchBookingsFor(resourceId);
    removeNotificationsByBookingId(bookingId);
    notifier?.success?.("Booking confirmed");
  }

  async function declineBooking(bookingId, resourceId) {
    if (!confirm("Decline this booking request?")) return;
    const res = await apiFetch(`/api/bookings/${bookingId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Failed to decline booking");
      return;
    }
    resourceBookings[String(resourceId)] = await fetchBookingsFor(resourceId);
    removeNotificationsByBookingId(bookingId);
    notifier?.success?.("Booking declined");
  }

  async function deleteResource(id) {
    if (!confirm("Delete this resource? This cannot be undone.")) return;
    const res = await apiFetch(`/api/resources/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      error = json.message || "Failed to delete resource";
      return;
    }
    resources = resources.filter((r) => String(r.id) !== String(id));
  }

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
      if (typeof globalThis.io === "function") {
        socket = globalThis.io(socketUrl, { withCredentials: true });
        ["resource:created","resource:deleted","availability:changed","booking:created","booking:deleted","booking:confirmed","booking:declined"].forEach((ev) => socket.on(ev, fetchResources));
        if (user?.username) socket.emit("joinUser", { username: user.username });
      }
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
                    <ResourceImages imagesString={resource.image} {resource} open={openPreviewFromResource} />
                  </td>
                  <td class="py-2">
                    <button class="bg-red-600 text-white px-2 py-1 rounded" on:click={() => deleteResource(resource.id)}>Delete</button>
                  </td>
                </tr>
                <tr>
                  <td colspan="4" class="bg-gray-50 px-4 py-2">
                    <div class="text-sm font-semibold mb-2">Bookings</div>
                    <BookingList bookings={resourceBookings[String(resource.id)]} resourceId={resource.id} confirm={confirmBooking} decline={declineBooking} />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
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
