import { toast } from "../store/toastStore.js";
import logger from "../lib/logger.js";
import apiFetch from "../lib/api.js";
export let baseURL = "/api";

export async function handleCreate(payload, files) {
  const filesArray = Array.isArray(files) ? files : files ? [files] : [];
  let imageUrls = [];
  if (!filesArray.length) {
    toast("At least one image is required", "error");
    return { ok: false };
  }

  for (const file of filesArray) {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const upload = await apiFetch(`${baseURL}/uploads`, {
        method: "POST",
        body: formData,
      });
      if (upload.ok) {
        const uploadData = await upload.json();
        if (uploadData && uploadData.url) imageUrls.push(uploadData.url);
      } else {
        logger.error("Image upload returned non-ok response");
      }
    } catch (error) {
      logger.error("Image upload failed", error && error.message ? error.message : error);
    }
  }

  let finalName = "";
  const { create, isCarCreate, createBrand, createModel, createYear } = payload;
  if (isCarCreate) {
    if (!createBrand || !createModel || !createYear) {
      toast("Brand, model and year are required for a car", "error");
      return { ok: false };
    }
    finalName = `${createBrand} ${createModel} ${createYear}`;
  } else {
    if (!create.name) {
      toast("Room name is required", "error");
      return { ok: false };
    }
    finalName = create.name;
  }

  const imageUrl = imageUrls.length ? imageUrls.join(";") : null;
  const res = await apiFetch(`${baseURL}/resources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  const res = await apiFetch(`${baseURL}/resources/${available.resourceId}/availabilities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await apiFetch(`${baseURL}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  toast(data.message || "Booking complete", "success");
  return { ok: true, data };
}
