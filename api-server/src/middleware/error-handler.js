const { fail } = require("../lib/respond");

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error("[api-error]", err);
  return fail(res, "Internal server error", 500, {
    message: err.message
  });
}

module.exports = {
  errorHandler
};
