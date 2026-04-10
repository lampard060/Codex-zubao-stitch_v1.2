const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(process.cwd(), ".env")
});

async function main() {
  const relativeFilePath = process.argv[2];

  if (!relativeFilePath) {
    throw new Error("Usage: node scripts/run-sql-file.js <relative-sql-file-path>");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in api-server/.env");
  }

  const sqlFilePath = path.resolve(process.cwd(), relativeFilePath);
  const sql = fs.readFileSync(sqlFilePath, "utf8");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await pool.query(sql);
    console.log(`Applied SQL file: ${relativeFilePath}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[run-sql-file]", error.message);
  process.exit(1);
});
