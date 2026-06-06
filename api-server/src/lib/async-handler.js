/**
 * Wraps an async Express route handler so that any rejected promise
 * is automatically forwarded to Express error-handling middleware.
 *
 * Usage:
 *   router.get("/path", wrap(async (req, res) => { ... }));
 */
function wrap(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { wrap };
