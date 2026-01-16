import { writable } from 'svelte/store';
import logger from './logger';

const initial = typeof window !== 'undefined' ? window.location.pathname : '/';
export const route = writable(initial);

export function navigate(to) {
  if (typeof window === 'undefined') return;
  if (to === window.location.pathname) {
    route.set(to);
    return;
  }

  history.pushState({}, '', to);
  route.set(to);
  try {
    window.dispatchEvent(new PopStateEvent('popstate'));
  } catch (error) {
    logger.info('PopStateEvent not supported, using fallback', error && error.message ? error.message : error);
    window.dispatchEvent(new Event('popstate'));
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => route.set(window.location.pathname));
}

export default { route, navigate };
