// Zero-dependency JSON-file datastore.
// Persists all collections to a single JSON file so the generated app runs with
// no external database. Swap this module for a real DB adapter in production.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DATA_FILE = process.env.DATA_FILE || "./data/store.json";

/** @type {Record<string, any[]>} */
let store = {};

export function initDb(collections) {
  if (existsSync(DATA_FILE)) {
    try {
      store = JSON.parse(readFileSync(DATA_FILE, "utf8"));
    } catch {
      store = {};
    }
  }
  for (const c of collections) if (!store[c]) store[c] = [];
  persist();
}

export function all(collection) {
  return store[collection] ?? [];
}

export function find(collection, id) {
  return (store[collection] ?? []).find((r) => r.id === id) ?? null;
}

export function insert(collection, row) {
  (store[collection] ??= []).push(row);
  persist();
  return row;
}

export function update(collection, id, patch) {
  const row = find(collection, id);
  if (!row) return null;
  Object.assign(row, patch);
  persist();
  return row;
}

export function remove(collection, id) {
  const arr = store[collection] ?? [];
  const idx = arr.findIndex((r) => r.id === id);
  if (idx < 0) return false;
  arr.splice(idx, 1);
  persist();
  return true;
}

function persist() {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}
