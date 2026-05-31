/**
 * Local persistent store. Loads seed once, stores in localStorage,
 * exposes simple read/write helpers.
 */
import { buildSeed } from './seed';

const STORAGE_KEY = 'hrms_demo_store_v1';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* quota exceeded — ignore for demo */ }
}

let state = load();
if (!state) {
  state = buildSeed();
  save(state);
}

export function getState() { return state; }
export function setState(updater) {
  state = typeof updater === 'function' ? updater(state) : updater;
  save(state);
  return state;
}

export function resetState() {
  state = buildSeed();
  save(state);
  return state;
}
