<script>
    import { onMount } from "svelte";
    import { navigate } from "../lib/router.js";
    import logger from "../lib/logger.js";

    let loading = true;
    let user = null;
    let resources = [];
    let error = null;
    let socket = null;

    async function fetchResources() {
        try {
            const res = await fetch('/api/resources/mine', { credentials: 'include' });
            if (!res.ok) return;
            resources = await res.json();
        } catch (error) {
            logger.error('Failed to fetch resources', error && error.message ? error.message : error);
        }
    }

    async function deleteResource(id) {
        if (!confirm("Delete this resource? This cannot be undone.")) return;
        try {
            const res = await fetch(`/api/resources/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            const content = res.headers.get("content-type");
            let data = {};
            if (content.includes("application/json")) data = await res.json();
            if (!res.ok) {
                error = data.message || "Failed to delete resource";
                return;
            }
            resources = resources.filter((resource) => String(resource.id) !== String(id));
        } catch (error) {
            logger.error("delete resource error", error && error.message ? error.message : error);
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

            const res = await fetch("/api/resources/mine", {
                credentials: "include",
            });
            if (!res.ok) {
                error = "Failed to load resources.";
                return;
            }
            resources = await res.json();
        } catch (error) {
                logger.error("myResources load error", error && error.message ? error.message : error);
        } finally {
            loading = false;
        }

        try {
            const socketUrl = process.env.BACKEND_ORIGIN;
            if (typeof globalThis.io === 'function') {
                socket = globalThis.io(socketUrl, { withCredentials: true });
                socket.on('resource:created', () => fetchResources());
                socket.on('resource:deleted', () => fetchResources());
                socket.on('availability:changed', () => fetchResources());
            }
        } catch (error) {
            logger.warn('socket setup in myResources failed', error && error.message ? error.message : error);
        }
    });
</script>

<section class="max-w-3xl mx-auto mt-8 bg-white rounded shadow p-6">
    <h2 class="text-2xl font-semibold mb-4">My resources</h2>

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
                    <th class="py-2">Image</th>
                </tr>
            </thead>
            <tbody>
                {#each resources as resource}
                    <tr class="align-top border-b">
                        <td class="py-2">{resource.name}</td>
                        <td class="py-2">{resource.type}</td>
                        <td class="py-2">
                            {#if resource.image}
                                <a
                                    href={resource.image}
                                    target="_blank"
                                    rel="noopener"
                                    class="text-sm text-blue-600">View</a
                                >
                            {:else}
                                —
                            {/if}
                        </td>
                        <td class="py-2">
                            <button
                                class="bg-red-600 text-white px-2 py-1 rounded"
                                on:click={() => deleteResource(resource.id)}
                                >Delete</button
                            >
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</section>
