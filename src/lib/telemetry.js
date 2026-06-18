import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Telemetry configuration via environment variables
// TELEMETRY_OTLP_ENDPOINT: full OTLP HTTP endpoint (e.g. https://otlp.example.com/v1/traces)
// TELEMETRY_OTLP_HEADERS: JSON string of headers to send with the OTLP exporter (e.g. '{"Authorization":"Bearer <KEY>"}')
// SERVICE_NAME: optional service name override

const endpoint = process.env.TELEMETRY_OTLP_ENDPOINT;
const headers = process.env.TELEMETRY_OTLP_HEADERS ? JSON.parse(process.env.TELEMETRY_OTLP_HEADERS) : undefined;
const serviceName = process.env.SERVICE_NAME || 'microinvest-prototype';

if (endpoint) {
  try {
    const traceExporter = new OTLPTraceExporter({
      url: endpoint,
      headers
    });

    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName
      }),
      traceExporter,
      instrumentations: [getNodeAutoInstrumentations()]
    });

    sdk.start()
      .then(() => {
        console.log('OpenTelemetry SDK started');
      })
      .catch((err) => {
        console.error('Error starting OpenTelemetry SDK', err);
      });

    process.on('exit', () => {
      sdk.shutdown().catch((err) => console.error('Error shutting down OTEL SDK', err));
    });
  } catch (err) {
    console.error('Failed to initialize OpenTelemetry', err);
  }
} else {
  // No endpoint configured; skip initializing exporter.
  console.log('TELEMETRY_OTLP_ENDPOINT not set — OpenTelemetry disabled');
}
