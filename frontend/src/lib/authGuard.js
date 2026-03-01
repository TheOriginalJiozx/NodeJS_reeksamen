import { navigate, route } from "./router.js";
import { authUser, ready, protectedRoutes } from "./auth.js";
import logger from "./logger.js";

let currentUser = null;
let guardActive = false;

authUser.subscribe((user) => (currentUser = user));

function initializeRouteGuard() {
  if (guardActive) return;

  ready.subscribe((isReady) => {
    if (!isReady) return;
    if (guardActive) return;
    guardActive = true;

    route.subscribe((routePath) => {
      enforceRouteProtection(routePath);
    });
  });
}

function enforceRouteProtection(routePath) {
  try {
    if (!routePath) return;
    
    const path = routePath.split("?")[0];
    if (protectedRoutes.has(path) && !currentUser) {
      logger.warn(`Unauthorized access attempt to ${path}`);
      navigate("/login");
    }
  } catch (error) {
    logger.error("authGuard route protection error", error?.message || error);
  }
}

initializeRouteGuard();
