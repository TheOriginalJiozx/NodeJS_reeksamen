export function dependencyInjectionMiddleware(io, sessionStore) {
  return (req, res, next) => {
    req.io = io;
    req.sessionStore = sessionStore;
    next();
  };
}

export default dependencyInjectionMiddleware;
