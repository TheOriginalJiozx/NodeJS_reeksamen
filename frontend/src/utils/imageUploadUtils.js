import { apiFetch } from "../lib/api.js";

const baseURL = "/api";

async function uploadImages(files) {
  const filesArray = Array.isArray(files) ? files : files ? [files] : [];
  const imageUrls = [];

  if (!filesArray.length) {
    return { ok: false, urls: [], error: "No files to upload" };
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
        if (uploadData?.url) imageUrls.push(uploadData.url);
      } else {
        const errorData = await upload.json().catch(() => ({}));
        const errorMessage = errorData.message || `Upload failed (${upload.status})`;
        return { ok: false, urls: imageUrls, error: errorMessage };
      }
    } catch (error) {
      return { ok: false, urls: imageUrls, error: error?.message || "Upload failed" };
    }
  }

  return { ok: true, urls: imageUrls, error: null };
}

export { uploadImages };
