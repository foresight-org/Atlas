"use strict";

/**
 * Vercel entry for the assistant connector.
 * Every path is rewritten here with ?route= so this stays one function.
 * Delete this file, and the rewrites, to remove the connector from production.
 */

const { handleAssistantRequest } = require("../server/assistant");

module.exports = function assistantHandler(req, res) {
  return handleAssistantRequest(req, res);
};
