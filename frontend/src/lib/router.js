import { writable } from "svelte/store";
import logger from "./logger";

const initial = typeof window !== "undefined" ? window.location.pathname : "/";
export const route = writable(initial);

export function navigate(to) {
  if (typeof window === "undefined") return;
  if (to === window.location.pathname) {
    route.set(to);
    return;
  }

  history.pushState({}, "", to); // spørgsmål - bruger pushState for at ændre URL uden at genindlæse siden
  route.set(to);
  try {
    // spørgsmål
    // Bruger PopStateEvent for at signalere ruteændring,
    // da det er den mest semantiske måde at håndtere navigation på,
    // og det sikrer kompatibilitet med browserens historikfunktioner
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch (error) {
    logger.info(
      "PopStateEvent not supported, using fallback",
      error && error.message ? error.message : error,
    );
    // spørgsmål
    // opretter en almindelig event, 
    // da PopStateEvent måske ikke er understøttet i ældre browsere
    window.dispatchEvent(new Event("popstate"));
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => route.set(window.location.pathname));
}

export default { route, navigate };
