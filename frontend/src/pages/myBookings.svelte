<script>
  import { onMount, onDestroy } from "svelte";
  import { navigate } from "../lib/router.js";
  import logger from "../lib/logger.js";
  import { loadAuthenticatedUser } from "../lib/auth.js";
  import ImagePreview from "../components/resources/imagesPreview.svelte";
  import BookingsTable from "../components/bookings/bookingsTable.svelte";
  import DefectedResourcesTable from "../components/bookings/defectedResourcesTable.svelte";
  import { notifications, removeNotificationsByBookingId, unseenBookingsCount, defectedBookingCount } from "../store/notificationsStore.js";
  import { fetchUserBookings, fetchAllBookings, fetchAllResources } from "../services/bookingService.js";
  import { setupNavbarSocket } from "../utils/navbarSocketUtils.js";
  import { reportDefect } from "../handlers/bookingHandlers.js";

  const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || window.location.origin;

  let loading = true;
  let user = null;
  let bookings = [];
  let defectedResources = [];
  let resources = [];
  let resourceMap = {};
  let socket = null;
  let previewData = null;

  async function fetchDefectedResources() {
    try {
      const response = await fetch(`${BACKEND_ORIGIN}/api/bookings/defected`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        defectedResources = data.defected || [];
        logger.info(`Loaded ${defectedResources.length} defected resources`);
      }
    } catch (error) {
      logger.warn("Failed to load defected resources", error?.message || error);
    }
  }

  async function updateDefectedCount() {
    try {
      const response = await fetch(`${BACKEND_ORIGIN}/api/bookings/defected-count`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        defectedBookingCount.set(data.defectCount || 0);
        await fetchDefectedResources();
        logger.info(`Updated defected count: ${data.defectCount}`);
      }
    } catch (error) {
      logger.warn("Failed to update defected count", error?.message || error);
    }
  }

  function getImages(images) {
    return String(images).split(";").filter(Boolean);
  }

  function openPreview(images, label, startIndex = 0) {
    previewData = { imagesString: images, label: label || "Image preview", startIndex };
  }

  async function loadData() {
    const parsed = loadAuthenticatedUser();
    if (!parsed || !parsed.id) {
      navigate("/login");
      return;
    }

    const userData = await fetchUserBookings(parsed.id);
    if (!userData) {
      navigate("/login");
      return;
    }

    user = userData.user || null;
    bookings = await fetchAllBookings(user?.fullname);
    const { resources: res, resourceMap: map } = await fetchAllResources();
    resources = res;
    resourceMap = map;
    
    await fetchDefectedResources();
    
    try {
      const countResult = await fetch(`${BACKEND_ORIGIN}/api/bookings/defected-count`, {
        credentials: "include"
      });
      if (countResult.ok) {
        const countData = await countResult.json();
        defectedBookingCount.set(countData.defectCount || 0);
      }
    } catch (error) {
      logger.warn("Failed to load defected count", error?.message || error);
    }
    
    try {
      const result = await fetch(`${BACKEND_ORIGIN}/api/bookings/unseen-count`, {
        credentials: "include"
      });
      if (result.ok) {
        const data = await result.json();
        unseenBookingsCount.set(data.unseenCount || 0);
      }
    } catch (error) {
      logger.warn("Failed to load unseen count", error?.message || error);
    }
  }

  async function cleanupNotifications() {
    let notificationsList = [];
    const unsubscribe = notifications.subscribe((list) => {
      notificationsList = list;
    });

    notificationsList.forEach((notification) => {
      if ((notification.type === "booking:confirmed" || notification.type === "booking:declined") && notification.bookingId) {
        removeNotificationsByBookingId(notification.bookingId);
      }
    });
    unsubscribe();
  }

  onMount(async () => {
    try {
      await cleanupNotifications();
      await loadData();
      socket = setupNavbarSocket(globalThis.io, BACKEND_ORIGIN, user?.fullname, {
        onBookingChange: loadData,
        onDefectUpdate: updateDefectedCount,
      });
    } catch (error) {
      logger.error("Error in myBookings", error?.message || error);
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (socket && typeof socket.disconnect === "function") {
      try {
        socket.disconnect();
      } catch (error) {
        logger.warn("Failed to disconnect socket", error?.message || error);
      }
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
        {:else}
          <BookingsTable
            {bookings}
            {resourceMap}
            on:openPreview={(event) => openPreview(event.detail.imagesString, event.detail.label, event.detail.startIndex)}
            on:markSeen={async (event) => {
              const { bookingId } = event.detail;
              try {
                const response = await fetch(`${BACKEND_ORIGIN}/api/bookings/${bookingId}/mark-seen`, {
                  method: "PATCH",
                  credentials: "include"
                });
                if (response.ok) {
                  await loadData();
                }
              } catch (error) {
                logger.error("Failed to mark booking as seen", error?.message || error);
              }
            }}
            on:reportDefect={async (event) => {
              const { bookingId, defectReport, defectImages } = event.detail;
              logger.info(`[myBookings] reportDefect event received: bookingId=${bookingId}`);
              logger.debug(`[myBookings] Calling reportDefect handler`);
              const result = await reportDefect(bookingId, defectReport, defectImages);
              logger.info(`[myBookings] reportDefect result: ok=${result.ok}`);
              if (result.ok) {
                logger.debug("[myBookings] Reloading data");
                await loadData();
              }
            }}
          />
        {/if}
      </section>

      <DefectedResourcesTable
        {defectedResources}
        on:markSeen={async () => {
          await loadData();
        }}
      />
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
