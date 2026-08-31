# 📡 Arvdoul Observability

Arvdoul ships a real, runnable observability stack — not stubs.

## Components

| Piece | Where | Status |
|---|---|---|
| Metrics collector | `src/services/metricsService.js` | ✅ counters, gauges, histograms, percentiles, Prometheus text export, CRLF-injection-safe names |
| RUM (Core Web Vitals) | `src/services/rumService.js` | ✅ LCP, CLS, INP, TTFB, long tasks, route timings, `attachToMetrics()` |
| Distributed tracing | `src/services/tracingService.js` | ✅ span lifecycle, W3C traceparent headers, Jaeger HTTP export when `jaegerEndpoint` is configured |
| Error budget / SLO | `src/services/observabilityService.js` | ✅ SLI math, burn-rate alerts, Firestore cost accounting |
| Dev scrape endpoint | Vite plugin in `vite.config.js` | ✅ `GET /metrics` on the dev server |
| Prometheus + alerts | `ops/prometheus/` | ✅ scrape config + SLO/error/cost alert rules |
| Grafana dashboard | `ops/grafana/` | ✅ provisioned "Arvdoul Overview" dashboard |
| Local stack | `ops/docker-compose.observability.yml` | ✅ one-command local observability |

## Local run (dev/dogfood)

```bash
# terminal 1 - the app (serves /metrics)
npm run dev

# terminal 2 - the stack
docker compose -f ops/docker-compose.observability.yml up -d

# verify
curl -s localhost:3000/metrics | head            # app metrics
open http://localhost:9090                       # Prometheus
open http://localhost:3001                       # Grafana (admin/admin - change it)
```

Grafana auto-provisions the datasource and the **Arvdoul Overview**
dashboard (latency percentiles, error rate, RUM vitals, GCP cost, long tasks).

## Metrics available

- `arvdoul_<counter>` — API counts, error counts, event totals
- `arvdoul_<gauge>` — active users, memory, RUM vitals (`rum_lcp`, `rum_cls`, `rum_inp`, `rum_ttfb`, `rum_long_tasks`)
- `arvdoul_<histogram>_percentiles{quantile="0.50|0.90|0.95|0.99"}` — latency percentiles
- `arvdoul_gcp_daily_accumulated_cost_dollars` — daily Firestore/CDN cost (alert at $120, cap $150)

## Alerting rules (`ops/prometheus/alerts.yml`)

- **ArvdoulErrorRateHigh** — per-API error rate > 1% for 5m (critical)
- **ArvdoulLatencySLOBreach** — p95 > 1.5s for 10m (warning)
- **ArvdoulRumLcpPoor / ArvdoulRumClsHigh** — Core Web Vitals degradation (warning)
- **ArvdoulBillingCapApproaching** — daily GCP spend > $120 (critical)

## Production

Client-side metrics are best-effort telemetry; the source of truth in
production is the Cloud Functions layer. Recommended production wiring:

1. Add a metrics HTTP function (`/metrics`) exposing server-side counters.
2. Push client metrics to a **Prometheus pushgateway** or **OTLP collector**
   (the service is structured so an exporter can be swapped in).
3. Point the `arvdoul-functions` scrape job in `prometheus.yml` at the
   deployed function URL.
4. Wire alertmanager (or Grafana Cloud) to PagerDuty/email.

## Correlation IDs

`src/utils/Logger.js` emits structured JSON with `correlationId`; pass the
same id through client → Cloud Function → Firestore writes to trace a
request end-to-end. Tracing spans are exported to Jaeger when
`tracingService.jaegerEndpoint` is set.
