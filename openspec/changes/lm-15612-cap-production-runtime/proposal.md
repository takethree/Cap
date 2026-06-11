## Why

Cap is deployed and reachable in Kubernetes, but production processing is incomplete: desktop recordings upload raw segments to S3 and then stall because the self-hosted deployment does not run the Workflow DevKit background runtime, the required AI/transcription provider keys are not injected, scheduled maintenance is not recreated outside Vercel, and the media server webhook URL points at the wrong in-cluster port.

This change completes the self-hosted production runtime for LM-15612 so new recordings can mux, transcribe, summarize, recover from stale uploads, and support the existing stuck test video after the runtime is healthy.

## What Changes

- Store and expose Cap provider keys from AWS Secrets Manager to Kubernetes without committing secret values to Git.
- Add self-hosted Workflow DevKit runtime support using a persistent PostgreSQL-backed world and a long-lived worker/startup path suitable for Kubernetes.
- Add Kubernetes CronJobs for Cap's Vercel cron equivalents, starting with stale desktop segment recovery and explicitly deciding whether developer-storage billing cron is enabled.
- Correct `MEDIA_SERVER_WEBHOOK_URL` so media-server callbacks reach the `cap-web` Kubernetes Service.
- Add a recovery runbook/task for the stuck video `dezxvbfyv1jy83c` after the runtime is deployed and verified.
- Keep the deployment managed through Terraform, Helm, Argo CD, and GitHub PRs using LM-15612 naming.

## Capabilities

### New Capabilities
- `cap-production-runtime`: Self-hosted production runtime for Cap background processing, provider key injection, scheduled jobs, media callbacks, and post-deploy stuck-video recovery.

### Modified Capabilities

## Impact

- `F:\infrastructure\apps\kubernetes`: Terraform for persistent workflow infrastructure, Secrets Manager references, generated Kubernetes runtime secret values, and Argo dependencies.
- `F:\cap\apps\web`: Workflow world dependency/startup wiring and any narrow self-hosting runtime code needed for Kubernetes.
- `F:\cap\deploy\k8s\chart`: Helm values/templates for provider env vars, workflow runtime env vars/jobs, CronJobs, and webhook URL correction.
- AWS Secrets Manager secret `kubernetes/cap/provider-keys/production`.
- Kubernetes namespace `cap`, especially `cap-web`, `cap-media-server`, `cap-runtime`, and new workflow/cron resources.
- S3 bucket `takethree-cap-production-159207264407-us-east-2`, used for validating generated `result.mp4`, preview GIF, transcript, and AI artifacts.
