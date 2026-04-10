const { fail } = require("../lib/respond");
const { query } = require("../lib/db");
const { readBearerToken, verifyToken } = require("../lib/token");

async function attachAuthUser(req, _res, next) {
  const token = readBearerToken(req);
  if (!token) {
    req.authUser = null;
    next();
    return;
  }

  const payload = verifyToken(token);
  if (!payload?.sub) {
    req.authUser = null;
    next();
    return;
  }

  const result = await query(
    `select
       u.id,
       u.role,
       u.phone,
       u.status,
       mp.display_name,
       tp.name as technician_name
     from users u
     left join merchant_profiles mp on mp.user_id = u.id
     left join technician_profiles tp on tp.user_id = u.id
     where u.id = $1`,
    [payload.sub]
  );

  req.authUser = result.rows[0] || null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.authUser) {
    return fail(res, "Authentication required", 401);
  }

  return next();
}

module.exports = {
  attachAuthUser,
  requireAuth
};
