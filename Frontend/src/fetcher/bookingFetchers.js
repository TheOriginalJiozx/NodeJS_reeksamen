import logger from '../lib/logger.js';
import { groupContinuousDates } from '../util/bookingUtils.js';
export let baseURL = "/api";

function computeDatesFromAvailabilities(avails) {
    const set = new Set();
    for (const available of avails || []) {
        if (!available.startDate || !available.endDate) continue;
        const start = new Date(available.startDate);
        const end = new Date(available.endDate);
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            set.add(`${year}-${month}-${day}`);
        }
    }
    return Array.from(set).sort();
}

export async function fetchAllResources() {
    const res = await fetch(`${baseURL}/resources`, { credentials: "include" });
    const resourcesAll = res.ok ? await res.json() : [];
    const availableResourceIds = new Set();

    for (const resource of resourcesAll) {
        try {
            const res = await fetch(`${baseURL}/resources/${resource.id}/availability`, { credentials: 'include' });
            if (!res.ok) continue;
            const data = await res.json();
            let availableDates = [];
            if (Array.isArray(data)) availableDates = data;
            else if (Array.isArray(data.availableDates)) availableDates = data.availableDates;
            else if (Array.isArray(data.availabilities)) availableDates = computeDatesFromAvailabilities(data.availabilities);
            if (availableDates.length > 0) availableResourceIds.add(String(resource.id));
        } catch (error) {
            logger.warn(`Failed to fetch availability for resource ${resource.id}`, error && error.message ? error.message : error);
        }
    }

    const firstBookable = resourcesAll.find((resource) => availableResourceIds.has(String(resource.id)));
    return { resourcesAll, availableResourceIds: Array.from(availableResourceIds), firstBookableId: firstBookable ? firstBookable.id : null };
}

export async function fetchTypes() {
    const res = await fetch(`${baseURL}/types`, { credentials: "include" });
    const types = res.ok ? await res.json() : [];
    return types;
}

export async function fetchOwnedResources() {
    const res = await fetch(`${baseURL}/resources/mine`, { credentials: 'include' });
    const resourcesOwned = res.ok ? await res.json() : [];
    return resourcesOwned;
}

export async function fetchAvailability(id) {
    if (!id) return { availability: [], availableDates: [], availableRanges: [] };
    const res = await fetch(`${baseURL}/resources/${id}/availability`, { credentials: 'include' });
    const raw = res.ok ? await res.json() : null;
    if (!raw) return { availability: [], availableDates: [], availableRanges: [] };

    let availability = [];
    let availableDates = [];

    if (Array.isArray(raw)) {
        availability = raw.map((available) => ({
            startDate: available.startDate ? (available.startDate.length >= 10 ? available.startDate.substring(0, 10) : available.startDate) : null,
            endDate: available.endDate ? (available.endDate.length >= 10 ? available.endDate.substring(0, 10) : available.endDate) : null,
        }));
        availableDates = computeDatesFromAvailabilities(availability);
    } else if (raw.availableDates) {
        availability = (raw.availabilities || []).map((a) => ({ startDate: a.startDate, endDate: a.endDate }));
        availableDates = Array.isArray(raw.availableDates) ? raw.availableDates : [];
    } else if (raw.availabilities) {
        availability = (raw.availabilities || []).map((a) => ({ startDate: a.startDate, endDate: a.endDate }));
        availableDates = computeDatesFromAvailabilities(availability);
    }

    const availableRanges = groupContinuousDates(availableDates);
    return { availability, availableDates, availableRanges };
}
