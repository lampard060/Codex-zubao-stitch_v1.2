const { fail } = require("./respond");

function readValue(req, headerName, queryName) {
  return req.headers[headerName] || req.query[queryName] || null;
}

function attachRequestContext(req, _res, next) {
  const authUserId = req.authUser?.id || null;
  req.ctx = {
    shopId: readValue(req, "x-shop-id", "shopId"),
    userId: readValue(req, "x-user-id", "userId") || authUserId,
    technicianUserId: readValue(req, "x-technician-user-id", "technicianUserId") || authUserId
  };

  next();
}

function requireShopContext(req, res, next) {
  if (!req.ctx?.shopId) {
    return fail(res, "Missing shop context. Provide x-shop-id or ?shopId=", 400);
  }

  return next();
}

function requireTechnicianContext(req, res, next) {
  if (!req.ctx?.technicianUserId) {
    return fail(res, "Missing technician context. Provide x-technician-user-id or ?technicianUserId=", 400);
  }

  return next();
}

function requireUserContext(req, res, next) {
  if (!req.ctx?.userId) {
    return fail(res, "Missing user context. Provide x-user-id or login first.", 400);
  }

  return next();
}

module.exports = {
  attachRequestContext,
  requireShopContext,
  requireTechnicianContext,
  requireUserContext
};
