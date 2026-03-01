import { toast } from "../store/toastStore.js";

function success(message, timeout) {
  toast(message, "success", timeout);
}

function error(message, timeout) {
  toast(message, "error", timeout);
}

function info(message, timeout) {
  toast(message, "info", timeout);
}

export default {
  success,
  error,
  info,
};
