import { toast as toastFn } from "../store/toastStore.js";

export function success(message, timeout) {
  toastFn(message, "success", timeout);
}

export function error(message, timeout) {
  toastFn(message, "error", timeout);
}

export function info(message, timeout) {
  toastFn(message, "info", timeout);
}

export default {
  success,
  error,
  info,
};
