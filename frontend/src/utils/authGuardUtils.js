import { route, navigate } from "../lib/router.js";
import user, { ready } from "../store/usersStore.js";
import logger from "../lib/logger.js";
import { protectedRoutes } from "../lib/authorization.js";

let currentUser = null;
user.subscribe((user) => (currentUser = user));
let guardActive = false;

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
    logger.error("authGuard route protection error", error && error.message ? error.message : error);
  }
}

initializeRouteGuard();

export { enforceRouteProtection };
