<script>
  import { onMount, onDestroy } from "svelte";
  import { navigate } from "../../lib/router.js";
  import { authUser, bootstrap } from "../../store/usersStore.js";
  import { resourceBookingCount, myBookingCount, clearNotifications, pushNotification } from "../../store/notificationsStore.js";
  import notifier from "../../lib/notifier.js";
  import { apiFetch, clearCsrfCache } from "../../lib/api.js";
  import { clearAuth } from "../../lib/authentication.js";
  import logger from "../../lib/logger.js";
  import notificationHandlers from "../../handlers/notificationHandlers.js";

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
          notificationHandlers.loadExistingNotifications(value.id);
          if (navSocket && typeof navSocket.disconnect === "function") {
            try {
              navSocket.disconnect();
            } catch (error) {
              logger.warn("Failed to disconnect previous nav socket connection", error && error.message ? error.message : error);
            }
            navSocket = null;
          }
          if (typeof globalThis.io === "function") {
            navSocket = globalThis.io(socketUrl, { withCredentials: true });
            
            const emitJoinUser = () => {
              try {
                if (value.fullname) {
                  navSocket.emit("joinUser", { username: value.fullname });
                  logger.info({ fullname: value.fullname }, "Emitted joinUser with fullname");
                }
              } catch (error) {
                logger.error("Failed to emit joinUser", error && error.message ? error.message : error);
              }
            };
            
            emitJoinUser();
            
            navSocket.on("connect", () => {
              try {
                logger.info("Nav socket connected");
                emitJoinUser();
              } catch (error) {
                logger.error("Failed on nav socket connect", error && error.message ? error.message : error);
              }
            });

            navSocket.on("disconnect", () => {
              logger.warn("Nav socket disconnected");
            });

            navSocket.on("connect_error", (error) => {
              logger.error("Nav socket connection error", error);
            });

            navSocket.on("booking:created", (payload) => {
              try {
                logger.debug({ payload }, "Received booking:created");
                pushNotification({ type: "booking", navTo: "/myresources", ...payload });
                notifier.info("New booking request");
              } catch (error) {
                logger.error("Failed to handle booking:created notification", error && error.message ? error.message : error);
              }
            });
            navSocket.on("booking:confirmed", (payload) => {
              try {
                logger.debug({ payload }, "Received booking:confirmed");
                pushNotification({ type: "booking:confirmed", navTo: "/mybookings", ...payload });
                notifier.success("A booking was confirmed");
              } catch (error) {
                logger.error("Failed to handle booking:confirmed notification", error && error.message ? error.message : error);
              }
            });
            navSocket.on("booking:declined", (payload) => {
              try {
                logger.debug({ payload }, "Received booking:declined");
                pushNotification({ type: "booking:declined", navTo: "/mybookings", ...payload });
                notifier.error("A booking was declined");
              } catch (error) {
                logger.error("Failed to handle booking:declined notification", error && error.message ? error.message : error);
              }
            });
          }
        } catch (error) {
          logger.warn("Failed to set up nav socket connection on user change", error && error.message ? error.message : error);
        }
      });
    } catch (error) {
      logger.warn("socket setup in navbar failed", error && error.message ? error.message : error);
    }
  });

  onDestroy(() => {
    if (unsubscribeAuthUser)
      try {
        unsubscribeAuthUser();
      } catch (error) {
        logger.warn("Failed to unsubscribe from user store in navbar on destroy", error && error.message ? error.message : error);
      }
    if (navSocket && typeof navSocket.disconnect === "function")
      try {
        navSocket.disconnect();
      } catch (error) {
        logger.warn("Failed to disconnect nav socket connection on destroy", error && error.message ? error.message : error);
      }
  });

  async function handleLogout(event) {
    event.preventDefault();
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      notifier.error(error && error.message ? error.message : "Network error");
    }
    try {
      clearAuth();
    } catch (error) {}
    try {
      clearCsrfCache();
    } catch (error) {
      logger.error("Error clearing CSRF cache on logout", error && error.message ? error.message : error);
    }
    if (navSocket && typeof navSocket.disconnect === "function") {
      try {
        navSocket.disconnect();
      } catch (error) {
        logger.warn("Failed to disconnect nav socket on logout", error && error.message ? error.message : error);
      }
      navSocket = null;
    }
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
        </a>
        <a href="/mybookings" class="text-black-800 hover:text-black">
          My Bookings
          {#if $myBookingCount > 0}
            <span class="ml-2 inline-block bg-red-600 text-white text-xs px-2 py-1 rounded">{$myBookingCount}</span>
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
