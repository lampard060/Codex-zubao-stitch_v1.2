const crypto = require("crypto");
const { env } = require("../config/env");

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  return Buffer.from(normalized, "base64").toString("utf8");
}

function sign(value) {
  return crypto
    .createHmac("sha256", env.jwtSecret)
    .update(value)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function issueToken(payload) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token) {
    return null;
  }

  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) {
    return null;
  }

  const expectedSignature = sign(`${header}.${body}`);
  if (expectedSignature !== signature) {
    return null;
  }

  const payload = JSON.parse(fromBase64Url(body));
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    return null;
  }

  return payload;
}

function readBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length);
}

module.exports = {
  issueToken,
  verifyToken,
  readBearerToken
};
