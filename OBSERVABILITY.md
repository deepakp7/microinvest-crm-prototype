Grafana + OpenTelemetry integration

This project includes a server-side OpenTelemetry initializer.

Environment variables (set in Vercel project settings or runtime):

- `TELEMETRY_OTLP_ENDPOINT` — full OTLP HTTP endpoint, e.g. `https://otlp-gateway-prod.grafana.net/otlp/v1/traces`
- `TELEMETRY_OTLP_HEADERS` — JSON string of headers to send, for example `{"Authorization":"Bearer <GRAFANA_API_KEY>"}`
- `SERVICE_NAME` — optional service name (defaults to `microinvest-prototype`)

How it works:
- `src/lib/telemetry.js` initializes the OpenTelemetry `NodeSDK` with auto-instrumentations and an OTLP HTTP exporter when `TELEMETRY_OTLP_ENDPOINT` is set.
- `src/hooks.server.js` imports the initializer so it runs on server startup in SvelteKit.

Grafana Cloud quick steps:
1. In Grafana Cloud create an API key with metrics/traces permissions.
2. Use the Cloud OTLP endpoint and provide the key as a Bearer token in `TELEMETRY_OTLP_HEADERS`.
3. Add the env vars to the Vercel project settings and redeploy.

Verify traces in Grafana Tempo / Traces view after generating traffic.
