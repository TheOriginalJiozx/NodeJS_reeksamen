import { route, navigate } from "./router.js";
import user, { ready } from "../store/usersStore.js";
import logger from "./logger.js";
import { protectedRoutes } from "./authorization.js";

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
