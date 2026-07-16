# DMS Load Testing

Seed thousands of mock rows into **`dms_db_backup`**, then stress Orders APIs with **k6**. Observe API metrics with local **OpenTelemetry Collector + Prometheus + Grafana**.

> **Safety:** Seed/cleanup scripts refuse to run unless `DB_NAME=dms_db_backup`. Do not point these tools at production databases.

## Prerequisites

- Node.js 18+
- Docker Desktop **running** (for observability stack)
- k6 installed locally:

```powershell
winget install --id GrafanaLabs.k6 -e
# then open a new terminal so `k6` is on PATH
```

- Backend `.env` with `DB_NAME=dms_db_backup`

## 1. Seed mock data (Faker)

```bash
cd backend
npm install
npm run seed:load-test
# optional overrides:
# npm run seed:load-test -- --orders 10000 --facilities 50 --providers 30
```

This creates:

- Load-test admin user: `loadtest` / `LoadTest@123` (`loadtest@dms.local`)
- `LT Facility …` facilities and `LT Provider …` providers
- ~10,000 `LT-…` orders + records, workflow stages, payments, and ~25% invoices

Cleanup:

```bash
npm run seed:load-test:cleanup
```

## 2. Enable load-test auth + (optional) OpenTelemetry

In `backend/.env` (dev only):

```env
DB_NAME=dms_db_backup
LOAD_TEST_MODE=true
TWO_FACTOR_DEV_LOG_CODE=true
JWT_ACCESS_EXPIRES_IN=1h
OTEL_ENABLED=true
OTEL_SERVICE_NAME=dms-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
```

Restart the API:

```bash
cd backend
npm run dev
```

When `LOAD_TEST_MODE=true`, `POST /api/auth/login` returns `data.devOtp` so k6 can complete 2FA without email.

## 3. Start observability stack

```bash
cd load-tests/observability
docker compose up -d
```

| Service | URL |
|---------|-----|
| Grafana | http://localhost:3001 (admin / admin) |
| Prometheus | http://localhost:9090 |
| OTLP HTTP | http://127.0.0.1:4318 |

Dashboard: **DMS Load Test Overview** (folder DMS).

Stop:

```bash
docker compose down
```

## 4. Run k6 scenarios

From the **repo root**:

```bash
# smoke (1 VU, 1m)
k6 run load-tests/k6/smoke.js

# primary ramp: 10 → 50 → 100 VUs
k6 run load-tests/k6/orders-read.js

# soak (25 VUs, 15m)
k6 run load-tests/k6/soak.js
```

Useful env vars:

| Variable | Default | Meaning |
|----------|---------|---------|
| `BASE_URL` | `http://127.0.0.1:5000` | API base |
| `LOAD_TEST_USER` | `loadtest` | Logon |
| `LOAD_TEST_PASSWORD` | `LoadTest@123` | Password |
| `VU_STAGE1/2/3` | 10 / 50 / 100 | Ramp targets |
| `P95_MS` | 1500 | List endpoint p95 threshold |
| `SOAK_VUS` | 25 | Soak concurrency |
| `SOAK_DURATION` | `15m` | Soak length |

Example:

```bash
k6 run -e BASE_URL=http://127.0.0.1:5000 -e VU_STAGE3=80 load-tests/k6/orders-read.js
```

Optional k6 OTel output (k6 v0.48+ experimental):

```bash
K6_OTEL_GRPC_EXPORTER_ENDPOINT=127.0.0.1:4317 \
  k6 run -o experimental-opentelemetry load-tests/k6/orders-read.js
```

## What is load-tested

Authenticated staff endpoints used by Orders:

- `GET /api/orders?pagination=keyset&pageSize=10` (+ cursor, search, facility, year)
- `GET /api/orders/stats`
- `GET /api/orders/companies`
- `GET /api/facilities`
- `GET /api/orders/:id`

## Success criteria (default thresholds)

- HTTP failure rate &lt; 1% (`orders-read`)
- `orders_list` p95 latency &lt; 1.5s
- Smoke allows looser limits for first connectivity check

## After testing

1. `npm run seed:load-test:cleanup` (optional)
2. Set `LOAD_TEST_MODE=false` and `OTEL_ENABLED=false`
3. Point `DB_NAME` back to your normal database if needed
4. `docker compose down` in `load-tests/observability`
