import { mount } from 'svelte';
import App from './App.svelte';
import './styles.css';
import logger from './lib/logger';

try {
  if (typeof Node !== 'undefined') {
    const desc = Object.getOwnPropertyDescriptor(Node.prototype, 'firstChild');
    if (!desc) {
      Object.defineProperty(Node.prototype, 'firstChild', {
        get() { return this.childNodes && this.childNodes[0] || null; },
        configurable: true
      });
    }
  }
} catch (error) {
  logger.error('Could not polyfill Node.firstChild', error && error.message ? error.message : error);
}

mount(App, { target: document.getElementById('app') });
