import toastStore from "../store/toastStore.js";

function success(message, timeout) {
  toastStore.toast(message, "success", timeout);
}

function error(message, timeout) {
  toastStore.toast(message, "error", timeout);
}

function info(message, timeout) {
  toastStore.toast(message, "info", timeout);
}

export default {
  success,
  error,
  info,
};
