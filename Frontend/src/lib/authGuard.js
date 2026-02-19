import { route, navigate } from "./router.js";
import user, { ready } from "../store/userStore.js";
import logger from "./logger.js";
const protectedRoutes = new Set(["/profile", "/booking", "/mybookings", "/myresources"]);

let currentUser = null;
user.subscribe((user) => (currentUser = user));
let started = false;
ready.subscribe((isReady) => {
  if (!isReady) return;
  if (started) return;
  started = true;

  route.subscribe((routePath) => {
    try {
      if (!routePath) return;
      const path = routePath.split("?")[0];
      if (protectedRoutes.has(path)) {
        if (!currentUser) {
          navigate("/login");
        }
      }
    } catch (error) {
      logger.error("authGuard route subscription error",
        error && error.message ? error.message : error,
      );
    }
  });
});

export default { protectedRoutes };
