# Kubernetes deployment (preview)

Minimal K8s manifests for running cinnamon. Full Kubernetes support with Helm charts is planned for a future phase.

## Manifests

| File | Resource | Purpose |
|------|----------|---------|
| `deployment.yaml` | Deployment x2 | API server and worker |
| `service.yaml` | Service | ClusterIP for the API |
| `cronjob.yaml` | CronJob | Scheduler (reconciles cron schedules) |

## Prerequisites

These manifests assume:

- Postgres and Redis are already running in the cluster (or externally).
- A Kubernetes Secret named `cinnamon-secrets` exists with `DATABASE_URL` and `REDIS_URL`.
- The `cinnamon:latest` image is built and pushed to your container registry.

## Usage

```bash
# Create the secret
kubectl create secret generic cinnamon-secrets \
  --from-literal=DATABASE_URL=postgresql://user:pass@postgres:5432/cinnamon \
  --from-literal=REDIS_URL=redis://redis:6379

# Apply manifests
kubectl apply -f deployment.yaml -f service.yaml -f cronjob.yaml
```

## What's missing

- Helm chart with configurable values
- Horizontal pod autoscaling for the worker
- Ingress / Gateway API configuration
- Migration Job resource (run once before deploying)
- Persistent volume claims for Postgres/Redis (use managed services in production)
