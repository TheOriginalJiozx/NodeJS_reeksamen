import { writable } from "svelte/store";
import logger from "./logger";

const initial = typeof window !== "undefined" ? window.location.pathname : "/";
const route = writable(initial);

function navigate(to) {
  if (typeof window === "undefined") return;
  if (to === window.location.pathname) {
    route.set(to);
    return;
  }

  history.pushState({}, "", to);
  route.set(to);
  try {
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch (error) {
    logger.info(
      "PopStateEvent not supported, using fallback",
      error?.message || error,
    );
    window.dispatchEvent(new Event("popstate"));
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => route.set(window.location.pathname));
}

export { route, navigate };
