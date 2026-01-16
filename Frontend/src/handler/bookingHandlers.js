import { toast } from "../store/toastStore.js";
import logger from '../lib/logger.js';
export let baseURL = "/api";

export async function handleCreate(payload, file) {
    let imageUrl = null;
    if (!file) {
        toast("Image is required", "error");
        return { ok: false };
    }

    if (file) {
        const formData = new FormData();
        formData.append("file", file);
        try {
            const up = await fetch(`${baseURL}/uploads`, {
                method: "POST",
                body: formData,
                credentials: "include",
            });
            if (up.ok) {
                const upData = await up.json();
                imageUrl = upData.url;
            }
        } catch (error) {
            logger.error("Image upload failed", error && error.message ? error.message : error);
        }
    }

    let finalName = '';
    const { create, isCarCreate, createBrand, createModel, createYear } = payload;
    if (isCarCreate) {
        if (!createBrand || !createModel || !createYear) {
            toast('Brand, model and year are required for a car', 'error');
            return { ok: false };
        }
        finalName = `${createBrand} ${createModel} ${createYear}`;
    } else {
        if (!create.name) {
            toast('Room name is required', 'error');
            return { ok: false };
        }
        finalName = create.name;
    }

    const res = await fetch(`${baseURL}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...create, name: finalName, imageUrl }),
    });

    let data = {};
    const content = res.headers.get("content-type") || "";
    if (content.includes("application/json")) data = await res.json();
    else data = { message: await res.text() };

    if (!res.ok) {
        toast(data.message || "Failed to create resource", "error");
        return { ok: false, data };
    }

    toast(data.message || "Resource created", "success");
    return { ok: true, data };
}

export async function handleAddAvailability(available) {
    if (!available || !available.resourceId) {
        toast("Select a resource before adding availability", "error");
        return { ok: false };
    }

    const res = await fetch(`${baseURL}/resources/${available.resourceId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(available),
    });

    let data = {};
    const content = res.headers.get("content-type") || "";
    if (content.includes("application/json")) data = await res.json();
    else data = { message: await res.text() };

    if (!res.ok) {
        toast(data.message || "Failed to add availability", "error");
        return { ok: false, data };
    }

    toast(data.message || "Availability added", "success");
    return { ok: true, data };
}

export async function handleBooking(booking) {
    const res = await fetch(`${baseURL}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(booking),
    });

    let data = {};
    const content = res.headers.get("content-type") || "";
    if (content.includes("application/json")) data = await res.json();
    else data = { message: await res.text() };

    if (!res.ok) {
        toast(data.message || "Failed to create booking", "error");
        return { ok: false, data };
    }

    toast(data.message || "Booking created", "success");
    return { ok: true, data };
}
