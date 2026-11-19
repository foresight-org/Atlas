"use strict";

/**
 * One built directory, shared by every signed-in member.
 *
 * Building the roster downloads the sheet and walks every row. Each
 * serverless instance used to do that for itself, then forget the result
 * a minute later, so the same work ran again on the next visit. The JSON
 * now lives in this process for ten minutes. On Vercel the other instances
 * in the region read that same snapshot instead of rebuilding it.
 *
 * The body is gzipped and stored only when the roster actually changed.
 * A small stamp is what expires every ten minutes, so a quiet day does
 * not keep writing the whole directory back into the cache.
 *
 * Member data never goes on the CDN. Handlers still send
 * `Cache-Control: private, no-store`. A profile save or RSVP drops both
 * layers through {@link invalidateAtlasCache}.
 */

const { createHash } = require("crypto");
const { gzipSync, gunzipSync } = require("zlib");

const TAG = "atlas-directory";
const FRESH_MS = 10 * 60 * 1000;
const BODY_TTL_SECONDS = 24 * 60 * 60;
const MAX_BODY_BYTES = 1_500_000;

/** @type {Map<string, { json: string, hash: string, builtAt: number }>} */
const memory = new Map();
/** @type {Map<string, Promise<string>>} */
const inflight = new Map();

let generation = 0;
/** @type {import("@vercel/functions").RuntimeCache | null | undefined} */
let runtimeCache;

function freshMs() {
  const override = Number(process.env.ATLAS_DIRECTORY_CACHE_MS);
  if (Number.isFinite(override) && override >= 1000) return override;
  return FRESH_MS;
}

function clampScope(scope) {
  if (scope === "map" || scope === "programming" || scope === "full") return scope;
  return "full";
}

function assertPublicDirectory(json) {
  if (json.includes('"passwordHash":')) {
    throw new Error("Refusing to serve a directory payload that includes passwordHash.");
  }
}

/**
 * Shared across instances on Vercel. Locally there is one process, so the
 * in-process map is the whole cache and this stays unused.
 */
function runtime() {
  if (!process.env.VERCEL) return null;
  if (runtimeCache !== undefined) return runtimeCache;
  try {
    runtimeCache = require("@vercel/functions").getCache({ namespace: "foresight-atlas" });
  } catch (error) {
    console.error("directory cache unavailable", error?.message || error);
    runtimeCache = null;
  }
  return runtimeCache;
}

/**
 * A layered build is `{ inner, community, layer }`. Anything else is one
 * body for every signed-in person (the local tests, and a cache written
 * before the community layer existed).
 */
function viewsFrom(json) {
  try {
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed.inner === "string" &&
      typeof parsed.community === "string" &&
      parsed.layer &&
      typeof parsed.layer === "object"
    ) {
      return {
        inner: parsed.inner,
        community: parsed.community,
        layer: parsed.layer,
      };
    }
  } catch {
    /* plain directory JSON */
  }
  return { inner: json, community: json, layer: null };
}

function remember(scope, json, hash, builtAt) {
  memory.set(scope, { json, hash, builtAt, views: viewsFrom(json) });
}

/**
 * @param {string} scope
 * @param {number} gen
 * @returns {Promise<string | null>} the JSON, or null when a save invalidated it mid-build
 */
async function fill(scope, build, gen) {
  const cache = runtime();
  if (cache && gen === generation) {
    try {
      const stamp = await cache.get(`directory:${scope}:at`);
      const stampFresh =
        stamp &&
        typeof stamp.hash === "string" &&
        typeof stamp.builtAt === "number" &&
        Date.now() - stamp.builtAt < freshMs();
      if (stampFresh) {
        if (gen !== generation) return null;
        const local = memory.get(scope);
        if (local && local.hash === stamp.hash) {
          local.builtAt = stamp.builtAt;
          return local.json;
        }
        const body = await cache.get(`directory:${scope}`);
        if (body && body.hash === stamp.hash && typeof body.gz === "string") {
          const json = gunzipSync(Buffer.from(body.gz, "base64")).toString("utf8");
          assertPublicDirectory(json);
          if (gen !== generation) return null;
          remember(scope, json, stamp.hash, stamp.builtAt);
          return json;
        }
      }
    } catch (error) {
      if (/passwordHash/.test(String(error?.message || ""))) throw error;
      console.error("directory cache read", error?.message || error);
    }
  }

  if (gen !== generation) return null;

  const value = await build();
  if (gen !== generation) return null;

  const json = JSON.stringify(value);
  assertPublicDirectory(json);
  const hash = createHash("sha256").update(json).digest("hex");
  const builtAt = Date.now();
  if (gen !== generation) return null;
  remember(scope, json, hash, builtAt);

  if (cache) {
    try {
      const existing = await cache.get(`directory:${scope}`);
      const bodyChanged = !existing || existing.hash !== hash;
      if (bodyChanged) {
        const gz = gzipSync(Buffer.from(json, "utf8")).toString("base64");
        if (Buffer.byteLength(gz) <= MAX_BODY_BYTES) {
          await cache.set(
            `directory:${scope}`,
            { hash, gz },
            {
              ttl: BODY_TTL_SECONDS,
              tags: [TAG],
              name: `atlas-directory-${scope}`,
            },
          );
        }
      }
      if (gen !== generation) return null;
      await cache.set(
        `directory:${scope}:at`,
        { hash, builtAt },
        {
          ttl: Math.ceil(freshMs() / 1000),
          tags: [TAG],
          name: `atlas-directory-${scope}-stamp`,
        },
      );
    } catch (error) {
      console.error("directory cache write", error?.message || error);
    }
  }

  return json;
}

/**
 * @param {string} scope
 * @param {() => Promise<unknown>} build
 * @returns {Promise<string>}
 */
async function cachedAtlasJson(scope, build) {
  const key = clampScope(scope);
  const local = memory.get(key);
  if (local && Date.now() - local.builtAt < freshMs()) return local.json;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    let last = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const gen = generation;
      const json = await fill(key, build, gen);
      if (json) last = json;
      if (json && gen === generation) return json;
    }
    if (last) return last;
    throw new Error("Directory cache was cleared while it was being built.");
  })().finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

/**
 * @param {import("http").ServerResponse} res
 * @param {string} scope
 * @param {() => Promise<unknown>} build
 * @param {string} [viewerId] signed-in person. Required once the build is layered.
 */
async function sendCachedDirectory(res, scope, build, viewerId, requested = "inner") {
  const { directoryViewFor } = require("./directory-layer");
  const json = await cachedAtlasJson(scope, build);
  const views = memory.get(clampScope(scope))?.views || viewsFrom(json);
  let body = views.inner;
  let served = "inner";
  if (views.layer) {
    const view = directoryViewFor(views.layer, viewerId, requested);
    if (!view) {
      res.status(401).json({ error: "Sign in to view the directory." });
      return;
    }
    served = view;
    body = view === "community" ? views.community : views.inner;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Atlas-Layer", served);
  res.setHeader("Access-Control-Expose-Headers", "X-Atlas-Layer");
  res.status(200).end(body);
}

/** Drop the shared snapshot. The next read rebuilds from the sheet. */
function invalidateAtlasCache() {
  generation += 1;
  memory.clear();
  const cache = runtime();
  if (!cache) return;
  void cache.expireTag(TAG).catch((error) => {
    console.error("directory cache expire", error?.message || error);
  });
}

module.exports = {
  cachedAtlasJson,
  sendCachedDirectory,
  invalidateAtlasCache,
};
