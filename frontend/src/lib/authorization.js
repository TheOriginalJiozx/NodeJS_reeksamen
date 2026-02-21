export const protectedRoutes = new Set(["/profile", "/booking", "/mybookings", "/myresources"]);

export function isAdmin(user) {
  return !!(user && user.role === "admin");
}

export function allowSelfOrAdmin(currentUser, targetId) {
  try {
    const requesterId = currentUser?.id ? String(currentUser.id) : null;
    if (requesterId && String(targetId) === String(requesterId)) return true;
    if (currentUser?.role === "admin") return true;
    return false;
  } catch {
    return false;
  }
}

const authorization = { protectedRoutes, isAdmin, allowSelfOrAdmin };
export default authorization;
