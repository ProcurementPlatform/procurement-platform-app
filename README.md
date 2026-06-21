# procurement-platform-app

Backend microservices (`identity`, `procurement`, `finance`, `document`, `ai`) + React frontend
for the Procurement Platform.

## CI/CD

- `build.yml` — lint, test, Docker build, Trivy vulnerability scan (all 6 images, fails on
  High/Critical), push to ECR.
- `deploy.yml` — after a successful build, bumps the image tag + IRSA role ARN in
  [procurement-platform-gitops](https://github.com/ProcurementPlatform/procurement-platform-gitops)'s
  `values-dev.yaml`/`values-prod.yaml` and pushes. **It never touches the cluster directly** — no
  `kubectl`, no `helm upgrade`. ArgoCD (watching the gitops repo only) picks up the change and
  syncs. `develop` branch → dev environment, `main` branch → prod environment.

## Related repos

- [procurement-platform-gitops](https://github.com/ProcurementPlatform/procurement-platform-gitops) — Helm chart + ArgoCD Application manifests
- [procurement-platform-infra](https://github.com/ProcurementPlatform/procurement-platform-infra) — Terraform infra + cluster add-ons
