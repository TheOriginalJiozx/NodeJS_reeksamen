import logger from "../lib/logger.js";

export async function parseResponse(res) {
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await res.json();
    } else {
      const text = await res.text();
      return { message: text };
    }
  } catch (error) {
    logger.error("Failed to parse response", error && error.message ? error.message : error);
    return { message: "Failed to parse response" };
  }
}

export function getErrorMessage(data, defaultMessage = "Operation failed") {
  return (data && data.message) ? data.message : defaultMessage;
}

export function getSuccessMessage(data, defaultMessage = "Operation successful") {
  return (data && data.message) ? data.message : defaultMessage;
}
