const express = require("express");
const cors = require("cors");
const zlib = require("zlib");
const { env } = require("./config/env");
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const merchantRoutes = require("./routes/merchant");
const masterDataRoutes = require("./routes/master-data");
const technicianRoutes = require("./routes/technicians");
const orderRoutes = require("./routes/orders");
const payrollRoutes = require("./routes/payroll");
const { notFoundHandler } = require("./middleware/not-found");
const { errorHandler } = require("./middleware/error-handler");
const { attachAuthUser } = require("./middleware/auth");
const { attachRequestContext } = require("./lib/request-context");

const app = express();
const allowedOrigins = Array.from(new Set([
  env.appUrl,
  env.appUrl.replace("127.0.0.1", "localhost"),
  env.appUrl.replace("localhost", "127.0.0.1")
]));

function isAllowedDevelopmentOrigin(origin = "") {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?$/.test(origin);
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isAllowedDevelopmentOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());

// Gzip compression for all API responses (reduces JSON/text payload size ~10x)
app.use((req, res, next) => {
  const acceptEncoding = req.headers["accept-encoding"] || "";
  if (!acceptEncoding.includes("gzip")) return next();
  const _send = res.send.bind(res);
  const _json = res.json.bind(res);
  const _end = res.end.bind(res);

  res.send = (body) => {
    if (typeof body === "string" || Buffer.isBuffer(body)) {
      res.set("Content-Encoding", "gzip");
      res.set("Vary", "Accept-Encoding");
      const compressed = require("zlib").gzipSync(body, { level: 6 });
      res.set("Content-Length", String(compressed.length));
      return _end(compressed);
    }
    return _send(body);
  };

  res.json = (body) => {
    res.set("Content-Encoding", "gzip");
    res.set("Vary", "Accept-Encoding");
    res.set("Content-Type", "application/json; charset=utf-8");
    const raw = JSON.stringify(body);
    const compressed = require("zlib").gzipSync(raw, { level: 6 });
    res.set("Content-Length", String(compressed.length));
    return _end(compressed);
  };

  next();
});

app.use(attachAuthUser);
app.use(attachRequestContext);

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "zubao-api",
    message: "ZuBao MVP API is online"
  });
});

app.use("/api/v1", healthRoutes);
app.use("/api/v1", authRoutes);
app.use("/api/v1", merchantRoutes);
app.use("/api/v1", masterDataRoutes);
app.use("/api/v1", technicianRoutes);
app.use("/api/v1", orderRoutes);
app.use("/api/v1", payrollRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
