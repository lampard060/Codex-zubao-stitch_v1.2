const { fail } = require("../lib/respond");
const { query } = require("../lib/db");

async function requireMerchantShopAccess(req, res, next) {
  if (!req.authUser) {
    return fail(res, "Authentication required", 401);
  }

  if (req.authUser.role !== "merchant") {
    return fail(res, "Merchant access required", 403);
  }

  const { shopId } = req.ctx || {};
  if (!shopId) {
    return fail(res, "Missing shop context. Provide x-shop-id or ?shopId=", 400);
  }

  const membershipResult = await query(
    `select
       shop_id,
       role_in_shop,
       membership_status
     from shop_staff_memberships
     where shop_id = $1
       and user_id = $2
       and membership_status = 'active'
       and role_in_shop in ('merchant_owner', 'merchant_manager')
     limit 1`,
    [shopId, req.authUser.id]
  );

  const membership = membershipResult.rows[0];
  if (!membership) {
    return fail(res, "You do not have access to this shop", 403);
  }

  req.ctx.userId = req.authUser.id;
  req.authorizedShopMembership = membership;
  return next();
}

function requireTechnicianSelf(req, res, next) {
  if (!req.authUser) {
    return fail(res, "Authentication required", 401);
  }

  if (req.authUser.role !== "technician") {
    return fail(res, "Technician access required", 403);
  }

  req.ctx.userId = req.authUser.id;
  req.ctx.technicianUserId = req.authUser.id;
  return next();
}

module.exports = {
  requireMerchantShopAccess,
  requireTechnicianSelf
};
