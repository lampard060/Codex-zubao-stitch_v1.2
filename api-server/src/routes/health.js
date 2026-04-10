const express = require("express");
const { ok, fail } = require("../lib/respond");
const db = require("../lib/db");

const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    const result = await db.healthcheck();
    return ok(res, {
      service: "zubao-api",
      status: "running",
      database: "connected",
      timestamp: new Date().toISOString(),
      serverTime: result.server_time
    });
  } catch (error) {
    return fail(res, "Database healthcheck failed", 500, {
      message: error.message
    });
  }
});

module.exports = router;
