"use strict";

/**
 * Open signup for the outer atlas.
 *
 * The role is fixed here. A request cannot ask to be a fellow, a grantee,
 * or a nodee. The email is stored on the roster row and is not returned
 * in the directory payload.
 */

const { rateLimit } = require("./rate-limit");

function clientIp(req) {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(req?.socket?.remoteAddress || "local");
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {(person: object, password: string, options: { community: true }) => Promise<unknown>} create
 */
async function registerCommunityAccount(req, create) {
  if (req.body?.consent !== true) {
    const err = new Error("Confirm that other community accounts may see your profile.");
    err.statusCode = 400;
    throw err;
  }

  const limit = rateLimit(`community-signup:${clientIp(req)}`, {
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.ok) {
    const err = new Error("Too many accounts were created from this network. Try again in a little while.");
    err.statusCode = 429;
    err.retryAfterSec = limit.retryAfterSec;
    throw err;
  }

  return create(
    {
      fullName: req.body?.fullName,
      email: req.body?.email,
      currentCity: req.body?.currentCity || "",
      currentCountry: req.body?.currentCountry || "",
      roleType: "Community",
      primaryNode: "Global",
    },
    req.body?.password,
    { community: true },
  );
}

module.exports = { registerCommunityAccount };
