/**
 * Optional OpenTelemetry bootstrap. Loaded only when OTEL_ENABLED=true.
 * Must be required before Express handlers attach.
 */

function startOpenTelemetry() {
  const config = require("./config");

  if (!config.otel?.enabled) {
    return null;
  }

  const { NodeSDK } = require("@opentelemetry/sdk-node");
  const {
    getNodeAutoInstrumentations,
  } = require("@opentelemetry/auto-instrumentations-node");
  const {
    OTLPTraceExporter,
  } = require("@opentelemetry/exporter-trace-otlp-http");
  const {
    OTLPMetricExporter,
  } = require("@opentelemetry/exporter-metrics-otlp-http");
  const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");
  const { resourceFromAttributes } = require("@opentelemetry/resources");
  const {
    ATTR_SERVICE_NAME,
  } = require("@opentelemetry/semantic-conventions");
  const logger = require("./utils/logger");

  const endpoint = String(config.otel.exporterUrl || "").replace(/\/$/, "");
  const traceUrl = `${endpoint}/v1/traces`;
  const metricsUrl = `${endpoint}/v1/metrics`;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.otel.serviceName || "dms-api",
    }),
    traceExporter: new OTLPTraceExporter({ url: traceUrl }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: metricsUrl }),
      exportIntervalMillis: 15000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();
  logger.info("OpenTelemetry enabled", {
    endpoint,
    serviceName: config.otel.serviceName,
  });

  const shutdown = async () => {
    try {
      await sdk.shutdown();
    } catch (_error) {
      // ignore shutdown errors
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return sdk;
}

module.exports = { startOpenTelemetry };
