import { apiFetch } from "../lib/api.js";
import notifier from "../lib/notifier.js";
import logger from "../lib/logger.js";
import { uploadImages } from "../utils/imageUploadUtils.js";
import { handleAuthorizationError } from "../lib/authorization.js";

const baseURL = "/api";

async function handleCreate(payload, files) {
  const uploadResult = await uploadImages(files);
  if (!uploadResult.ok) {
    notifier.error(`Image upload failed: ${uploadResult.error}`);
    return { ok: false };
  }

  const imageUrls = uploadResult.urls;
  if (!imageUrls.length) {
    notifier.error("At least one image is required");
    return { ok: false };
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

  const imageUrl = imageUrls.join(";");
  
  let body = { ...create, imageUrl };
  if (isCarCreate) {
    body.brand = createBrand;
    body.model = createModel;
    body.year = createYear;
  } else {
    body.name = finalName;
  }
  
  const res = await apiFetch(`${baseURL}/resources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const authError = handleAuthorizationError(res);
  if (authError) {
    notifier.error(authError.message);
    return { ok: false, data: authError };
  }

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

  const authError = handleAuthorizationError(res);
  if (authError) {
    notifier.error(authError.message);
    return { ok: false, data: authError };
  }

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

  const authError = handleAuthorizationError(response);
  if (authError) {
    notifier.error(authError.message);
    return { ok: false, data: authError };
  }

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

async function reportDefect(bookingId, defectReport, defectImages) {
  logger.info(`[reportDefect] Starting with bookingId=${bookingId}`);
  
  const uploadResult = await uploadImages(defectImages);
  if (!uploadResult.ok) {
    notifier.error(`Image upload failed: ${uploadResult.error}`);
    return { ok: false };
  }

  const defectImageUrl = uploadResult.urls.length > 0 ? uploadResult.urls.join(";") : null;
  
  const response = await apiFetch(`${baseURL}/bookings/${bookingId}/defect`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ defectReport, defectImage: defectImageUrl }),
  });

  const authError = handleAuthorizationError(response);
  if (authError) {
    notifier.error(authError.message);
    return { ok: false };
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    logger.error(`[reportDefect] Failed: ${data.message}`);
    notifier.error(data.message || "Failed to report defect");
    return { ok: false };
  }

  notifier.success(data.message || "Defect reported successfully");
  logger.info(`[reportDefect] Success!`);
  return { ok: true };
}

export { handleCreate, handleAddAvailability, handleBooking, reportDefect };
