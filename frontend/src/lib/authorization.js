export const protectedRoutes = new Set(["/profile", "/booking", "/mybookings", "/myresources"]);

export function isAdmin(user) {
  return !!(user && user.role === "admin");
}

const authorization = { protectedRoutes, isAdmin };
export default authorization;
