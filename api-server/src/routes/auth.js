const express = require("express");
const { ok, fail } = require("../lib/respond");
const { query } = require("../lib/db");
const { verifyPassword } = require("../lib/password");
const { issueToken } = require("../lib/token");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/auth/login", async (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) {
    return fail(res, "Phone and password are required", 400);
  }

  const result = await query(
    `select
       u.id,
       u.role,
       u.phone,
       u.password_hash,
       u.status,
       mp.display_name,
       tp.name as technician_name
     from users u
     left join merchant_profiles mp on mp.user_id = u.id
     left join technician_profiles tp on tp.user_id = u.id
     where u.phone = $1`,
    [phone]
  );

  const user = result.rows[0];
  if (!user || user.status !== "active") {
    return fail(res, "Invalid phone or password", 401);
  }

  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    return fail(res, "Invalid phone or password", 401);
  }

  const membershipResult = await query(
    `select
       sm.shop_id,
       s.name as shop_name,
       sm.membership_status,
       sm.role_in_shop
     from shop_staff_memberships sm
     join shops s on s.id = sm.shop_id
     where sm.user_id = $1
     order by
       case sm.membership_status when 'active' then 0 else 1 end,
       coalesce(sm.joined_at, sm.created_at) desc
     limit 1`,
    [user.id]
  );

  await query(
    `update users
     set last_login_at = now(), updated_at = now()
     where id = $1`,
    [user.id]
  );

  const token = issueToken({
    sub: user.id,
    role: user.role,
    phone: user.phone,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  });

  return ok(res, {
    token,
    user: {
      id: user.id,
      role: user.role,
      phone: user.phone,
      displayName: user.display_name || user.technician_name || null
    },
    membership: membershipResult.rows[0] || null
  });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const membershipResult = await query(
    `select
       sm.shop_id,
       s.name as shop_name,
       sm.membership_status,
       sm.role_in_shop
     from shop_staff_memberships sm
     join shops s on s.id = sm.shop_id
     where sm.user_id = $1
     order by
       case sm.membership_status when 'active' then 0 else 1 end,
       coalesce(sm.joined_at, sm.created_at) desc
     limit 1`,
    [req.authUser.id]
  );

  return ok(res, {
    user: {
      id: req.authUser.id,
      role: req.authUser.role,
      phone: req.authUser.phone,
      displayName: req.authUser.display_name || req.authUser.technician_name || null
    },
    membership: membershipResult.rows[0] || null
  });
});

module.exports = router;
