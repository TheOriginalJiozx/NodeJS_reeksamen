import { toast } from "../store/toastStore.js";

export function success(message, timeout) {
  toast(message, "success", timeout);
}

export function error(message, timeout) {
  toast(message, "error", timeout);
}

export function info(message, timeout) {
  toast(message, "info", timeout);
}

export default {
  success,
  error,
  info,
};
