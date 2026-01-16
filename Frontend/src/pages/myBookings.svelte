<script>
    import { onMount } from "svelte";
    import { navigate } from "../lib/router.js";
    import logger from "../lib/logger.js";

    let loading = true;
    let user = null;
    let bookings = [];
    let resources = [];
    let resourceMap = {};
    let error = null;
    let socket = null;

    function formatDateOnly(value) {
        if (!value) return "";
        if (typeof value === "string") {
            const time = value.indexOf("T");
            if (time !== -1) return value.substring(0, time);
            return value.split(" ")[0];
        }
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    async function fetchBookings() {
        try {
            const res = await fetch('/api/bookings', { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            bookings = Array.isArray(data.bookings) ? data.bookings : data.bookings || [];
            if (user && user.username) bookings = bookings.filter(bookings => String(bookings.booker) === String(user.username));
            bookings.sort((left, right) => new Date(left.start_date || left.startDate || 0) - new Date(right.start_date || right.startDate || 0));
        } catch (error) {
            logger.error('Failed to fetch bookings');
        }
    }

    onMount(async () => {
        try {
            const me = await fetch("/api/me", { credentials: "include" });
            if (me.status === 401) {
                navigate("/login");
                return;
            }
            const meData = await me.json();
            user = meData.user || null;

            await Promise.all([fetchBookings(), (async () => {
                try {
                    const res = await fetch('/api/resources', { credentials: 'include' });
                    resources = res.ok ? await res.json() : [];
                    resourceMap = {};
                    for (const resource of resources) resourceMap[String(resource.id)] = resource;
                } catch (error) {
                    logger.error('Failed to fetch resources');
                }
            })()]);

            try {
                const socketUrl = process.env.BACKEND_ORIGIN;
                if (typeof globalThis.io === 'function') {
                    socket = globalThis.io(socketUrl, { withCredentials: true });
                    socket.on('booking:created', () => fetchBookings());
                    socket.on('booking:deleted', () => fetchBookings());
                    socket.on('availability:changed', () => fetchBookings());
                }
            } catch (error) {
                logger.warn('socket setup in myBookings failed', error && error.message ? error.message : error);
            }
        } catch (error) {
            logger.error("Error fetching bookings or resources", error && error.message ? error.message : error);
        } finally {
            loading = false;
        }
    });
</script>

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
                    <th class="py-2">Comment</th>
                    <th class="py-2">Image</th>
                </tr>
            </thead>
            <tbody>
                {#each bookings as booking}
                    <tr class="align-top border-b">
                        <td class="py-2">
                            {#if resourceMap[String(booking.resource_id) || String(booking.resourceId)]}
                                {resourceMap[
                                    String(booking.resource_id) ||
                                        String(booking.resourceId)
                                ].name}
                            {:else}
                                Resource {booking.resource_id ||
                                    booking.resourceId}
                            {/if}
                        </td>
                        <td class="py-2">
                            {formatDateOnly(
                                booking.start_date || booking.startDate,
                            )} — {formatDateOnly(
                                booking.end_date ||
                                    booking.endDate ||
                                    booking.start_date ||
                                    booking.startDate,
                            )}
                        </td>
                        <td class="py-2">{booking.comment || ""}</td>
                        <td class="py-2">
                            {#if booking.image}
                                <a
                                    href={booking.image}
                                    target="_blank"
                                    rel="noopener"
                                    class="text-sm text-blue-600">View</a
                                >
                            {:else if resourceMap[String(booking.resource_id) || String(booking.resourceId)] && resourceMap[String(booking.resource_id) || String(booking.resourceId)].image}
                                <a
                                    href={resourceMap[
                                        String(booking.resource_id) ||
                                            String(booking.resourceId)
                                    ].image}
                                    target="_blank"
                                    rel="noopener"
                                    class="text-sm text-blue-600">View</a
                                >
                            {:else}
                                —
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</section>
