const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const config = require("./config");
const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { uploadsRoot } = require("./config/uploads");
const stripeWebhookController = require("./controllers/stripeWebhookController");

const app = express();

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.set("trust proxy", 1);

app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(cookieParser());

app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookController.handleStripeWebhook
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use("/uploads", express.static(uploadsRoot));

if (config.nodeEnv !== "test") {
  app.use(morgan("dev"));
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "dms-api" });
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
