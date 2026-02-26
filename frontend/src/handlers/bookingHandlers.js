import { apiFetch } from "../lib/api.js";
import notifier from "../lib/notifier.js";
import logger from "../lib/logger.js";

const baseURL = "/api";

async function handleCreate(payload, files) {
  const filesArray = Array.isArray(files) ? files : files ? [files] : [];
  let imageUrls = [];
  if (!filesArray.length) {
    notifier.error("At least one image is required");
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
      notifier.error("Brand, model and year are required for a car");
      return { ok: false };
    }
    finalName = `${createBrand} ${createModel} ${createYear}`;
  } else {
    if (!create.name) {
      notifier.error("Room name is required");
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
  const content = res.headers.get("content-type");
  if (content.includes("application/json")) data = await res.json();
  else data = { message: await res.text() };

  if (!res.ok) {
    notifier.error(data.message || "Failed to create resource");
    return { ok: false, data };
  }

  notifier.success(data.message || "Resource created");
  return { ok: true, data };
}

async function handleAddAvailability(available) {
  if (!available || !available.resourceId) {
    notifier.error("Select a resource before adding availability");
    return { ok: false };
  }

  const res = await apiFetch(`${baseURL}/resources/${available.resourceId}/availabilities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(available),
  });

  let data = {};
  const content = res.headers.get("content-type");
  if (content.includes("application/json")) data = await res.json();
  else data = { message: await res.text() };

  if (!res.ok) {
    notifier.error(data.message || "Failed to add availability");
    return { ok: false, data };
  }

  notifier.success(data.message || "Availability added");
  return { ok: true, data };
}

async function handleBooking(booking) {
  const response = await apiFetch(`${baseURL}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  });

  let data = {};
  const content = response.headers.get("content-type");
  if (content.includes("application/json")) data = await response.json();
  else data = { message: await response.text() };

  if (!response.ok) {
    notifier.error(data.message || "Failed to create booking");
    return { ok: false, data };
  }

  notifier.success(data.message || "Booking complete");
  return { ok: true, data };
}

export default {
  handleCreate,
  handleAddAvailability,
  handleBooking,
};
