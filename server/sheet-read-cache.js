"use strict";

/**
 * Shared Google Sheets read cache — short TTL + in-flight coalescing.
 *
 * Sheets quotas are typically ~60 read requests / minute / user. Without this,
 * a single GET /api/database could fan out into a dozen values.get calls, and
 * concurrent tabs / serverless instances would blow past the limit.
 *
 * Writes should call {@link invalidateSheetReadCache} so the next read sees
 * fresh data; otherwise data can lag by up to TTL_MS. That also drops the
 * shared directory snapshot kept by atlas-response-cache.
 */

const TTL_MS = 45 * 1000;

/** @type {Map<string, { expiresAt: number, value: unknown }>} */
const cache = new Map();
/** @type {Map<string, Promise<unknown>>} */
const inflight = new Map();

/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} loader
 * @returns {Promise<T>}
 */
async function cachedSheetRead(key, loader) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return /** @type {T} */ (hit.value);
  }

  const pending = inflight.get(key);
  if (pending) return /** @type {Promise<T>} */ (pending);

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
      inflight.delete(key);
      return value;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return /** @type {Promise<T>} */ (promise);
}

/**
 * Drop cached reads. Pass a prefix to clear a family (e.g. `"range:"`).
 * Assembled directory snapshots are always dropped, because they were
 * built from these rows. A prefix-only clear used to leave `map-db` in
 * place, and the shared response cache would then remember that stale copy.
 */
function invalidateSheetReadCache(prefix) {
  if (!prefix) {
    cache.clear();
  } else {
    for (const key of cache.keys()) {
      if (
        key.startsWith(prefix) ||
        key.startsWith("map-db:") ||
        key.startsWith("full-db:")
      ) {
        cache.delete(key);
      }
    }
  }
  require("./atlas-response-cache").invalidateAtlasCache();
}

module.exports = {
  TTL_MS,
  cachedSheetRead,
  invalidateSheetReadCache,
};
