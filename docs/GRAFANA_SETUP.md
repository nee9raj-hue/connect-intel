# Grafana wiring for Connect Intel

Production metrics: `GET https://connectintel.net/api/metrics` (requires `METRICS_SECRET` or `CRON_SECRET`).

## 1. One-command wiring

```bash
npm run grafana:connect
```

This script:
1. Syncs `METRICS_SECRET` on Vercel (same as `CRON_SECRET` in `.env.deploy.local`)
2. Syncs `GRAFANA_CLOUD_PROMETHEUS_*` to Vercel (for the cron push below)
3. Runs `npm run grafana:verify`
4. Optionally deploys Railway `grafana-alloy` (Dockerfile in `infra/grafana/`)
5. Imports the dashboard when `.env.grafana.secrets` has Grafana Cloud API creds

## 2. Vercel cron push (recommended — no Railway Alloy required)

`vercel.json` runs `GET /api/grafana/metrics-cron` every **5 minutes**. The handler renders in-process Prometheus metrics and remote-writes to Grafana Cloud.

**Vercel production env** (set automatically by `npm run grafana:connect`):

| Variable | Source |
|----------|--------|
| `GRAFANA_CLOUD_PROMETHEUS_URL` | Grafana Cloud → Prometheus → Details → Remote Write URL |
| `GRAFANA_CLOUD_PROMETHEUS_USERNAME` | Stack numeric instance ID |
| `GRAFANA_CLOUD_PROMETHEUS_PASSWORD` | Access policy token with `metrics:write` |

Manual test after deploy:

```bash
curl "https://connectintel.net/api/grafana/metrics-cron?secret=$CRON_SECRET"
```

Expected: `{"ok":true,"series":N,"status":200}`

## 3. Preflight only

```bash
npm run grafana:verify
```

Run [Grafana Alloy](https://grafana.com/docs/alloy/latest/) on Railway as an optional fallback. The Vercel cron path above is simpler and already live.

### Env vars (Railway service `grafana-alloy`)

| Variable | Source |
|----------|--------|
| `CONNECTINTEL_METRICS_URL` | `https://connectintel.net/api/metrics?secret=YOUR_METRICS_SECRET` |
| `GRAFANA_CLOUD_PROMETHEUS_URL` | Grafana Cloud → Prometheus → Details → Remote Write URL |
| `GRAFANA_CLOUD_PROMETHEUS_USERNAME` | Usually your stack numeric ID |
| `GRAFANA_CLOUD_PROMETHEUS_PASSWORD` | Grafana Cloud → Access Policies → MetricsPublisher token |

Copy `infra/grafana/alloy.config` into the Alloy container (default path `/etc/alloy/config.alloy`).

### Railway one-liner

```bash
# New service from grafana/alloy image, mount config, set env above
docker run -v "$PWD/infra/grafana/alloy.config:/etc/alloy/config.alloy:ro" \
  -e CONNECTINTEL_METRICS_URL="https://connectintel.net/api/metrics?secret=..." \
  -e GRAFANA_CLOUD_PROMETHEUS_URL="..." \
  -e GRAFANA_CLOUD_PROMETHEUS_USERNAME="..." \
  -e GRAFANA_CLOUD_PROMETHEUS_PASSWORD="..." \
  grafana/alloy:latest run /etc/alloy/config.alloy
```

## 4. Import dashboard

Grafana Cloud → Dashboards → Import → upload `infra/grafana/dashboard-connectintel.json`.

Panels: API latency histograms, pipeline rows read, queue jobs, worker health (from health check if wired).

## 5. Alerts (optional)

| Alert | PromQL |
|-------|--------|
| High API errors | `rate(connectintel_api_pipeline_total{status="error"}[5m]) > 0.05` |
| Slow search | `histogram_quantile(0.95, rate(connectintel_platform_search_duration_seconds_bucket[5m])) > 2` |

## 6. Vercel log drain (complement)

Filter Vercel logs for `event":"api_pipeline"` for per-request `durationMs` when Prometheus counters are cold after deploy.
