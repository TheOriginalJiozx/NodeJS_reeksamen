<script>
  import { onMount, onDestroy } from "svelte";
  import { navigate } from "../lib/router.js";
  import logger from "../lib/logger.js";
  import authUtils from "../utils/authUtils.js";
  import ImagePreview from "../components/resources/imagePreview.svelte";
  import BookingsTable from "../components/bookings/bookingsTable.svelte";
  import { notifications, removeNotificationsByBookingId } from "../store/notificationsStore.js";
  import { fetchUserBookings, fetchAllBookings, fetchAllResources } from "../services/bookingService.js";
  import { setupBookingSocket, disconnectSocket } from "../services/bookingSocket.js";

  const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || window.location.origin;

  let loading = true;
  let user = null;
  let bookings = [];
  let resources = [];
  let resourceMap = {};
  let socket = null;
  let previewData = null;

  function getImages(images) {
    return String(images).split(";").filter(Boolean);
  }

  function openPreview(images, label, startIndex = 0) {
    previewData = { imagesString: images, label: label || "Image preview", startIndex };
  }

  async function loadData() {
    const parsed = authUtils.loadAuthenticatedUser();
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
      socket = setupBookingSocket(BACKEND_ORIGIN, user, loadData);
    } catch (error) {
      logger.error("Error in myBookings", error && error.message ? error.message : error);
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    disconnectSocket(socket);
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
          />
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
