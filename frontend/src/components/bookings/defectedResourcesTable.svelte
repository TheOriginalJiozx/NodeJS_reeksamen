<script>
  import { createEventDispatcher } from "svelte";
  import logger from "../../lib/logger.js";

  const dispatch = createEventDispatcher();
  const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || window.location.origin;

  export let defectedResources = [];
</script>

{#if defectedResources.length > 0}
  <section class="max-w-3xl mx-auto mt-8 bg-white rounded shadow p-6">
    <h2 class="text-2xl font-semibold mb-4">Defected Resources</h2>
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="text-sm text-gray-600 border-b">
            <th class="py-2">Resource Name</th>
            <th class="py-2">Owner</th>
            <th class="py-2">Date</th>
            <th class="py-2">Status</th>
            <th class="py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {#each defectedResources as defected}
            <tr class="border-b">
              <td class="py-2">{defected.resource_name || "Unknown"}</td>
              <td class="py-2">{defected.resource_owner || "Unknown"}</td>
              <td class="py-2 text-sm text-gray-600">
                {new Date(defected.created_at).toLocaleDateString()}
              </td>
              <td class="py-2">
                {#if defected.seen}
                  <span class="text-sm text-gray-600">Seen</span>
                {:else}
                  <span class="text-sm text-orange-600 font-semibold">New</span>
                {/if}
              </td>
              <td class="py-2">
                {#if !defected.seen}
                  <button
                    type="button"
                    class="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                    on:click={async () => {
                      try {
                        const response = await fetch(`${BACKEND_ORIGIN}/api/bookings/defected/${defected.id}/mark-seen`, {
                          method: "PATCH",
                          credentials: "include"
                        });
                        if (response.ok) {
                          dispatch("markSeen", { defectId: defected.id });
                        }
                      } catch (error) {
                        logger.error("Failed to mark as seen", error?.message || error);
                      }
                    }}
                  >
                    Mark as seen
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}
