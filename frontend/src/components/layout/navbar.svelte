<script>
  import { onMount, onDestroy } from "svelte";
  import { navigate } from "../../lib/router.js";
  import { authUser, bootstrap } from "../../lib/auth.js";
  import { resourceBookingCount, defectReportedCount, defectedBookingCount, clearNotifications, unseenBookingsCount } from "../../store/notificationsStore.js";
  import logger from "../../lib/logger.js";
  import { loadExistingNotifications } from "../../handlers/notificationHandlers.js";
  import { fetchDefectCount } from "../../fetchers/defectCountersFetcher.js";
  import { setupNavbarSocket } from "../../utils/navbarSocketUtils.js";
  import { handleLogout as handleLogoutUtil } from "../../handlers/logoutHandler.js";

  const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || window.location.origin;

  let navSocket = null;
  let unsubscribeAuthUser = null;

  onMount(() => {
    bootstrap();
    try {
      const socketUrl = BACKEND_ORIGIN;
      unsubscribeAuthUser = authUser.subscribe((value) => {
        try {
          if (!value || !value.fullname) return;
          clearNotifications();
          loadExistingNotifications(value.id);
          
          fetchDefectCount().then((result) => {
            if (result.ok) {
              defectedBookingCount.set(result.count);
            }
          }).catch((error) => {
            logger.warn("Failed to load defect count", error?.message || error);
          });

          if (navSocket && typeof navSocket.disconnect === "function") {
            try {
              navSocket.removeAllListeners?.();
              navSocket.disconnect();
            } catch (error) {
              logger.warn("Failed to disconnect previous nav socket connection", error?.message || error);
            }
            navSocket = null;
          }
          if (typeof globalThis.io === "function") {
            navSocket = setupNavbarSocket(globalThis.io, socketUrl, value.fullname, {
              onDefectUpdate: async () => {
                try {
                  logger.info("[NAVBAR] onDefectUpdate callback triggered - Fetching defected count");
                  const defResult = await fetch(`${BACKEND_ORIGIN}/api/bookings/defected-count`, {
                    credentials: "include"
                  });
                  if (defResult.ok) {
                    const defData = await defResult.json();
                    defectedBookingCount.set(defData.defectCount || 0);
                    logger.info(`[NAVBAR] onDefectUpdate: Updated defectedBookingCount to ${defData.defectCount}`);
                  }
                } catch (error) {
                  logger.error("[NAVBAR] onDefectUpdate: Failed to update defected count", error?.message || error);
                }
              },
              onBookingChange: async () => {
                try {
                  const result = await fetch(`${BACKEND_ORIGIN}/api/bookings/unseen-count`, {
                    credentials: "include"
                  });
                  if (result.ok) {
                    const data = await result.json();
                    unseenBookingsCount.set(data.unseenCount || 0);
                  } else {
                    logger.warn(`FAIL: Unseen count fetch failed with status ${result.status}`);
                  }
                  
                  const defResult = await fetch(`${BACKEND_ORIGIN}/api/bookings/defected-count`, {
                    credentials: "include"
                  });
                  if (defResult.ok) {
                    const defData = await defResult.json();
                    defectedBookingCount.set(defData.defectCount || 0);
                  } else {
                    logger.warn(`FAIL: Defected count fetch failed with status ${defResult.status}`);
                  }
                } catch (error) {
                  logger.error("EXCEPTION in onBookingChange", error);
                }
              }
            });
          }
        } catch (error) {
          logger.warn("Failed to set up nav socket connection on user change", error?.message || error);
        }
      });
    } catch (error) {
      logger.warn("socket setup in navbar failed", error?.message || error);
    }
  });

  onDestroy(() => {
    if (unsubscribeAuthUser)
      try {
        unsubscribeAuthUser();
      } catch (error) {
        logger.warn("Failed to unsubscribe from user store in navbar on destroy", error?.message || error);
      }
    if (navSocket && typeof navSocket.disconnect === "function")
      try {
        navSocket.removeAllListeners?.();
        navSocket.disconnect();
      } catch (error) {
        logger.warn("Failed to disconnect nav socket connection on destroy", error?.message || error);
      }
  });

  async function handleLogout(event) {
    event.preventDefault();
    await handleLogoutUtil(navSocket);
    navigate("/login");
  }
</script>

<nav class="bg-white text-black p-4">
  <div class="container mx-auto flex items-center justify-between">
    <div class="bg-white p-2 rounded mr-4">
      <img src="/bookinglogo.png" alt="Logo" class="h-10 w-auto" />
    </div>
    <div class="space-x-4">
      <a href="/" class="text-black-800 hover:text-black">Home</a>
      {#if $authUser}
        <a href="/profile" class="text-black-800 hover:text-black">Profile</a>
        <a href="/myresources" class="text-black-800 hover:text-black">
          My Resources
          {#if $resourceBookingCount > 0}
            <span class="ml-2 inline-block bg-red-600 text-white text-xs px-2 py-1 rounded">{$resourceBookingCount}</span>
          {/if}
          {#if $defectReportedCount > 0}
            <span class="ml-2 inline-block bg-orange-600 text-white text-xs px-2 py-1 rounded">{$defectReportedCount}</span>
          {/if}
        </a>
        <a href="/mybookings" class="text-black-800 hover:text-black">
          My Bookings
          {#if $unseenBookingsCount > 0}
            <span class="ml-2 inline-block bg-red-600 text-white text-xs px-2 py-1 rounded">{$unseenBookingsCount}</span>
          {/if}
        </a>
        <a href="/mybookings" class="text-black-800 hover:text-black">
          Defects (Deleted Resources)
          {#if $defectedBookingCount > 0}
            <span class="ml-2 inline-block bg-red-800 text-white text-xs px-2 py-1 rounded">{$defectedBookingCount}</span>
          {/if}
        </a>
        <a href="/settings" class="text-black-800 hover:text-black">Settings</a>
        <a href="/create" class="text-black-800 hover:text-black">Create a Resource</a>
        <a href="/book" class="text-black-800 hover:text-black">Book</a>
        <button type="button" on:click={handleLogout} class="bg-red-600 text-white px-4 py-2 rounded">Logout</button>
      {:else}
        <a href="/register" class="inline-block bg-green-600 text-white px-4 py-2 rounded">Register</a>
        <a href="/login" class="inline-block bg-blue-600 text-white px-4 py-2 rounded">Login</a>
      {/if}
    </div>
  </div>
</nav>
