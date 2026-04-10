const { fail } = require("../lib/respond");

function notFoundHandler(req, res) {
  return fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

module.exports = {
  notFoundHandler
};
