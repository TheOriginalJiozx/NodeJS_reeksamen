import { writable } from 'svelte/store';

let idCounter = 0;
const toasts = writable([]);

export function toast(message, type = 'success', timeout = 4000) {
  const id = ++idCounter;
  toasts.update(list => [{ id, message, type }, ...list]);
  if (timeout > 0) setTimeout(() => remove(id), timeout);
  return id;
}

export function remove(id) {
  toasts.update(list => list.filter(item => item.id !== id));
}

export default { toast, remove, toasts };
export { toasts };
