export const protectedRoutes = new Set(["/profile", "/booking", "/mybookings", "/myresources"]);

const authorization = { protectedRoutes };
export default authorization;
