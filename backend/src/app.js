const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const config = require("./config");
const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
