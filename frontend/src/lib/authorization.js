const protectedRoutes = new Set(["/profile", "/booking", "/mybookings", "/myresources", "/book", "/create"]);

function isAdmin(user) {
  return !!(user && user.role === "admin");
}

export { protectedRoutes, isAdmin };
