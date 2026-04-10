const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH || path.resolve(process.cwd(), ".env")
});

function requireEnv(name, fallback = "") {
  const value = process.env[name] || fallback;
  if (value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3001),
  appUrl: process.env.APP_URL || "http://localhost:4173",
  apiUrl: process.env.API_URL || "http://localhost:3001",
  databaseUrl: requireEnv("DATABASE_URL", "postgresql://zubao_user:change_me@127.0.0.1:5432/zubao"),
  jwtSecret: requireEnv("JWT_SECRET", "change_me_to_a_long_random_secret")
};

module.exports = {
  env
};
