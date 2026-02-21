<script>
  import { onMount } from "svelte";
  import { navigate } from "../lib/router.js";
  import logger from "../lib/logger.js";
  import apiFetch from "../lib/api.js";
  import notifier from "../lib/notifier.js";
  import ImagePreview from "../components/imagePreview.svelte";
  import BookingRow from "../components/bookingRow.svelte";

  let loading = true;
  let user = null;
  let bookings = [];
  let resources = [];
  let resourceMap = {};
  let error = null;
  let socket = null;
  let previewData = null;

  function getImages(images) {
    return String(images).split(";").filter(Boolean);
  }

  function openPreview(images, label, startIndex = 0) {
    previewData = { imagesString: images, label: label || "Image preview", startIndex };
  }

  async function fetchBookings() {
    try {
      const res = await apiFetch("/api/bookings", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      bookings = Array.isArray(data.bookings) ? data.bookings : data.bookings || [];
      if (user && user.username) bookings = bookings.filter((bookings) => String(bookings.booker) === String(user.username));
      bookings.sort((left, right) => new Date(left.start_date || left.startDate || 0) - new Date(right.start_date || right.startDate || 0));
    } catch (error) {
      logger.error("Failed to fetch bookings");
    }
  }

  onMount(async () => {
    try {
      const cached = localStorage.getItem("user");
      let parsed = null;
      try {
        parsed = cached ? JSON.parse(cached) : null;
      } catch {
        parsed = null;
      }
      if (!parsed || !parsed.id) {
        navigate("/login");
        return;
      }
      const me = await apiFetch(`/api/users/${parsed.id}`, { credentials: "include" });
      if (me.status === 401) {
        navigate("/login");
        return;
      }
      const meData = await me.json();
      user = meData.user || null;

      await Promise.all([
        fetchBookings(),
        (async () => {
          try {
            const res = await apiFetch("/api/resources", { credentials: "include" });
            resources = res.ok ? await res.json() : [];
            resourceMap = {};
            for (const resource of resources) resourceMap[String(resource.id)] = resource;
          } catch (error) {
            logger.error("Failed to fetch resources");
          }
        })(),
      ]);

      try {
        const socketUrl = import.meta.env.VITE_BACKEND_ORIGIN || window.location.origin;
        if (typeof globalThis.io === "function") {
          socket = globalThis.io(socketUrl, { withCredentials: true });
          socket.on("booking:created", () => fetchBookings());
          socket.on("booking:deleted", () => {
            notifier.info("A booking was removed");
            fetchBookings();
          });
          socket.on("booking:confirmed", () => {
            try {
              notifier.success("Your booking was confirmed");
            } catch (error) {
              logger.error("Failed to show booking confirmed notification", error && error.message ? error.message : error);
            }
            fetchBookings();
          });
          socket.on("booking:declined", () => {
            try {
              notifier.error("Your booking was declined");
            } catch (error) {
              logger.error("Failed to show booking declined notification", error && error.message ? error.message : error);
            }
            fetchBookings();
          });
          socket.on("availability:changed", () => fetchBookings());
        }
      } catch (error) {
        logger.warn("socket setup in myBookings failed", error && error.message ? error.message : error);
      }
    } catch (error) {
      logger.error("Error fetching bookings or resources", error && error.message ? error.message : error);
    } finally {
      loading = false;
    }
  });
</script>

<div class="container mx-auto px-4">
  <div class="bg-gray-100 rounded-2xl shadow-xl overflow-hidden">
    <div class="py-4 md:py-12 px-6">
      <section class="max-w-3xl mx-auto mt-8 bg-white rounded shadow p-6">
        <h2 class="text-2xl font-semibold mb-4">My bookings</h2>

        {#if loading}
          <div class="text-gray-600">Loading...</div>
        {:else if error}
          <div class="text-red-600">{error}</div>
        {:else if bookings.length === 0}
          <div class="text-gray-600">You have no bookings.</div>
        {:else}
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-sm text-gray-600 border-b">
                <th class="py-2">Resource</th>
                <th class="py-2">Dates</th>
                <th class="py-2">Status</th>
                <th class="py-2">Comment</th>
                <th class="py-2">Image(s)</th>
              </tr>
            </thead>
            <tbody>
              {#each bookings as booking}
                <BookingRow {booking} {resourceMap} on:openPreview={(event) => openPreview(event.detail.imagesString, event.detail.label, event.detail.startIndex)} />
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
    </div>
  </div>
</div>

{#if previewData}
  <ImagePreview
    images={getImages(previewData.imagesString)}
    startIndex={previewData.startIndex}
    label={previewData.label}
    on:close={() => (previewData = null)}
  ></ImagePreview>
{/if}
