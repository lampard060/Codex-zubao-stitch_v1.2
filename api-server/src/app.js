const express = require("express");
const cors = require("cors");
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
