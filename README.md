# Cloud-Agnostic Auto-Scaling Strategy Evaluation Platform

Runnable project module aligned to the BMSIT&M Phase-2 PDF and designed as an add-on to [AegisCloud](https://github.com/saurav7809/Ageis-Cloud). It evaluates CPU-, trend-, and latency-based replica policies, stores samples and decisions, registers container image references, and exposes a dashboard with REST + Server-Sent Events (SSE).

> **Important honesty boundary:** the built-in experiment runner uses a deterministic, controlled **SIMULATED_WORKLOAD** model to compare strategies. It does not measure a real Kubernetes cluster or claim production benchmark results. Host CPU/memory are read from the API container/runtime and labelled `OBSERVED_HOST`. Real metrics can be pushed to the API; a live Kubernetes scaler/Prometheus pull adapter must be connected and configured before claiming real-cluster autoscaling.

## Included

- React + TypeScript dashboard: Overview, Image Registry, Experiments, Live Telemetry, Strategy Comparison, Scaling Events, Infrastructure.
- FastAPI backend with typed validation and OpenAPI docs.
- Image reference registration, duplicate detection, registry metadata, optional Docker daemon image discovery endpoint.
- CPU threshold, rate trend, and response-latency strategy evaluation under RAMP/SPIKE/STEADY/WAVE workloads.
- Persistent SQLite history for images, experiments, telemetry samples and scaling decisions.
- Near-real-time dashboard polling and SSE sample stream.
- External metric ingestion endpoint; source provenance included with every record.
- Docker Compose stack for API and dashboard.

## Start with Docker Compose

Install Docker Engine/Desktop + Docker Compose. Then from this directory:

```bash
docker compose -f compose.yaml up --build
```

Open:

- Dashboard: http://localhost:5173
- API docs: http://localhost:8080/docs
- Health: http://localhost:8080/healthz

Data persists in the `autoscaling_data` volume. Stop with `docker compose -f compose.yaml down`; remove the database too with `docker compose -f compose.yaml down -v`.

## Run locally without Docker

API (Python 3.11+ recommended):

```bash
cd backend
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --port 8080
```

Dashboard (Node.js 20+ recommended):

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` and `/healthz` to `http://localhost:8080` for local development. For a custom API host set `VITE_API_URL` in `.env.local`.

## Workflow

1. Open **Image Registry** → Register image. Use an image reference such as `nginx:1.27-alpine` or `ghcr.io/acme/checkout:1.4.2`. This stores an image reference; it does not pull or deploy the image.
2. Open **New evaluation** → choose the registered image, workload profile, duration, targets, and policies → Start evaluation.
3. See telemetry, replica decisions, and samples as the run executes.
4. Use **Strategy Comparison** to compare mean and p95 latency, CPU, replica usage, scaling churn, and the transparent project-specific evaluation score.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/healthz` | Health check |
| GET | `/api/v1/overview` | Dashboard totals + observed host + latest sample |
| GET / POST | `/api/v1/images` | List/register image references |
| DELETE | `/api/v1/images/{image_id}` | Delete a registration |
| POST | `/api/v1/images/discover-docker` | Import references from Docker daemon if CLI/daemon access exists |
| GET / POST | `/api/v1/experiments` | List/start workload evaluations |
| GET | `/api/v1/experiments/{id}` | Experiment, samples and scaling history |
| GET | `/api/v1/experiments/{id}/compare` | Strategy comparison and score formula |
| POST | `/api/v1/metrics/ingest` | Ingest external telemetry samples |
| GET | `/api/v1/metrics` | Query persisted samples |
| GET | `/api/v1/scaling-events` | Query scaling decisions |
| GET | `/api/v1/stream` | SSE stream of new samples |
| GET | `/api/v1/host/metrics` | Observed host metrics |
| GET | `/api/v1/prometheus/status` | Check whether a Prometheus URL is configured |
| GET | `/api/v1/prometheus/snapshot` | Query configured Prometheus for common host, application and Kubernetes metrics |

### Push an external metric sample

```bash
curl -X POST http://localhost:8080/api/v1/metrics/ingest \
  -H 'Content-Type: application/json' \
  -d '{"cpu_percent":42.1,"memory_percent":61.0,"latency_ms":118.4,"request_rate":87,"replicas":3,"source":"PROMETHEUS","note":"Pushed from configured telemetry adapter"}'
```

Valid provenance labels: `PROMETHEUS`, `OTEL`, `KUBERNETES`, or `MANUAL`. These labels are supplied by the client and should only be used when the source actually matches.

For optional pull-based queries, set `PROMETHEUS_URL` in the environment before starting Compose, for example `PROMETHEUS_URL=http://host.docker.internal:9090 docker compose -f compose.yaml up --build` (on Linux, configure the appropriate host reachability). Check `/api/v1/prometheus/status` then query `/api/v1/prometheus/snapshot`. It uses common node-exporter, application histogram/counter, and kube-state-metrics names; missing series return `null`, not fabricated values. Adapt the queries for your own instrumentation.

## Strategy definitions

- **CPU:** increase or decrease replicas against configured CPU target with basic hysteresis.
- **Trend:** adjusts when the last three request-rate observations are strictly increasing/decreasing and resource pressure conditions permit.
- **Latency:** adjusts replica count when model/observed latency crosses the target threshold.

The comparison score is a project-defined heuristic, clamped to 0–100:

`100 - 35 * (avg_latency_ms / target_latency_ms) - 0.25 * avg_cpu_percent - 0.7 * scaling_events`

It is not a standard SLO or industry benchmark. Use repeated, versioned experiments, documented infrastructure, measured data and statistical analysis in research results. This module currently runs strategies sequentially in a controlled model, so treat its results as comparative demonstrations rather than production-performance evidence.

## Image registration and security

The registry stores the exact image reference, parsed tag/digest display metadata, source, status and timestamp. Manual registration does not authenticate to Docker Hub/GHCR/ECR/ACR/GAR, inspect registry manifests, scan vulnerabilities, or verify that a tag exists. Docker discovery is available only when the API environment can access the Docker daemon; the provided Compose setup does **not** mount the host Docker socket by default, intentionally avoiding privileged daemon access.

Before production use, add authentication and organization-level authorization, registry credentials via secrets, image digest verification, audit logging, request rate limits, database migrations/backups, and TLS. Do not expose this development service directly to the public internet.

## Connecting it to the parent AegisCloud repository

This is a standalone evaluation module so it does not overwrite your existing React or Spring Boot control-plane files. Integrate it with `saurav7809/Ageis-Cloud` by:

1. Adding these dashboard pages or consolidating their components into the existing `web/` app.
2. Porting or proxying the API contracts into `control-plane/` if the final architecture requires Spring Boot as the sole backend.
3. Using the existing Fabric8/Kubernetes abstraction to apply HPA/Deployment changes under policy control; the simulation API itself deliberately does not mutate clusters.
4. Wiring Prometheus/OTel adapters to ingest actual metrics, and retaining source/provenance with every result.

## Research mapping to your PDF

- Workload configuration and CPU/trend/latency policies → Experiments.
- Runtime metrics: CPU, memory, latency, request rate, replicas → Live Telemetry.
- Image registration → Image Registry.
- Scaling event trace and reason → Scaling Events.
- Comparative strategy metrics and resource-usage score → Strategy Comparison.
- Docker and cloud portability → Compose deployment; the future cluster adapter should use Kubernetes APIs rather than provider-specific actions.
- Self-healing, Prometheus/Grafana and true multi-cloud benchmarking are integration steps, not falsely marked as completed by this standalone module.
