# Grafana wiring for Connect Intel

Production metrics: `GET https://connectintel.net/api/metrics` (requires `METRICS_SECRET` or `CRON_SECRET`).

## 1. One-command wiring

```bash
npm run grafana:connect
```

This script:
1. Syncs `METRICS_SECRET` on Vercel (same as `CRON_SECRET` in `.env.deploy.local`)
2. Runs `npm run grafana:verify`
3. Deploys Railway `grafana-alloy` (Dockerfile in `infra/grafana/`)
4. Imports the dashboard when `.env.grafana.secrets` has Grafana Cloud API creds

### Grafana Cloud credentials (one-time)

1. Sign up free: https://grafana.com/auth/sign-up/create-user (use **Google** → nee9raj@gmail.com)
2. Stack slug is your subdomain, e.g. `yourstack` → `yourstack.grafana.net`
3. **Prometheus → Details** → copy Remote write URL + Instance ID
4. **Administration → Cloud access policies** → token with `metrics:write`
5. Copy `.env.grafana.secrets.example` → `.env.grafana.secrets` and fill values
6. Re-run `npm run grafana:connect`

## 2. Preflight only

```bash
npm run grafana:verify
```

Run [Grafana Alloy](https://grafana.com/docs/alloy/latest/) on Railway (or any always-on host). It scrapes Vercel `/api/metrics` and remote-writes to Grafana Cloud Prometheus.

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

## 3. Import dashboard

Grafana Cloud → Dashboards → Import → upload `infra/grafana/dashboard-connectintel.json`.

Panels: API latency histograms, pipeline rows read, queue jobs, worker health (from health check if wired).

## 4. Alerts (optional)

| Alert | PromQL |
|-------|--------|
| High API errors | `rate(connectintel_api_pipeline_total{status="error"}[5m]) > 0.05` |
| Slow search | `histogram_quantile(0.95, rate(connectintel_platform_search_duration_seconds_bucket[5m])) > 2` |

## 5. Vercel log drain (complement)

Filter Vercel logs for `event":"api_pipeline"` for per-request `durationMs` when Prometheus counters are cold after deploy.
