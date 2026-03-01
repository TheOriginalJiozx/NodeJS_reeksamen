import logger from "../lib/logger.js";

async function parseResponse(res) {
  try {
    const contentType = res.headers.get("content-type");
    if (contentType.includes("application/json")) {
      return await res.json();
    } else {
      const text = await res.text();
      return { message: text };
    }
  } catch (error) {
    logger.error("Failed to parse response", error?.message || error);
    return { message: "Failed to parse response" };
  }
}

function getErrorMessage(data, defaultMessage = "Operation failed") {
  return data?.message || defaultMessage;
}

function getSuccessMessage(data, defaultMessage = "Operation successful") {
  return data?.message || defaultMessage;
}

export { parseResponse, getErrorMessage, getSuccessMessage };
