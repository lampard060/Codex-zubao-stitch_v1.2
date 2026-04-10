const { Pool } = require("pg");
const { env } = require("../config/env");

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000
});

async function query(text, params) {
  return pool.query(text, params);
}

async function healthcheck() {
  const result = await pool.query("select now() as server_time");
  return result.rows[0];
}

module.exports = {
  pool,
  query,
  healthcheck
};
