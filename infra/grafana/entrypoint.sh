#!/bin/sh
set -e
if [ -z "$GRAFANA_CLOUD_PROMETHEUS_URL" ] || [ -z "$CONNECTINTEL_METRICS_SECRET" ]; then
  echo "grafana-alloy: waiting for GRAFANA_CLOUD_PROMETHEUS_URL + CONNECTINTEL_METRICS_SECRET"
  echo "Fill .env.grafana.secrets then: npm run grafana:connect"
  sleep infinity
fi
exec /bin/alloy run /etc/alloy/config.alloy --server.http.listen-addr=0.0.0.0:12345
