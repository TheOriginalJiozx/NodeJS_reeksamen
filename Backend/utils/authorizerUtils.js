import { encryptPassword, validatePassword } from "../auth/authentication.js";

const authorizer = { encryptPassword, validatePassword };
export default authorizer;
