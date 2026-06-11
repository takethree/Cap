## Context

Cap production is live at `https://cap.take3tech.dev` through Argo CD, Cloudflare Tunnel, Kubernetes, MySQL, S3, and the media server. A test recording uploaded raw desktop segments into the private S3 bucket, but the video stayed in `desktopSegments` state because the Workflow DevKit job that should call `/video/mux-segments` never ran. The media server was healthy, but it received no mux request.

The Cap app uses Vercel Workflow DevKit (`workflow/api`) for desktop segment finalization, transcription, AI summary generation, imports, edits, and reprocessing. Vercel provides the workflow world automatically, but Kubernetes needs a self-hosted world with durable storage and queue polling. Cap also has Vercel cron entries that are not currently represented as Kubernetes CronJobs.

Provider credentials are now stored in AWS Secrets Manager at `kubernetes/cap/provider-keys/production` in account `159207264407`, region `us-east-2`. Terraform already manages the `cap-runtime` Kubernetes Secret and can merge those values into the Kubernetes runtime without committing secret material to Git.

## Goals / Non-Goals

**Goals:**
- Make new desktop recordings progress from raw S3 segments to `result.mp4`, preview assets, DB source `desktopMP4`, transcript, and AI summary.
- Keep provider keys, workflow database credentials, generated runtime secrets, and cron secrets out of Git.
- Use Terraform in `F:\infrastructure` for persistent infrastructure and generated Kubernetes secrets.
- Use Helm and Argo CD in the Cap repository for Kubernetes workloads and runtime wiring.
- Replace Vercel cron behavior with Kubernetes CronJobs.
- Correct the media server webhook URL so callback requests hit the in-cluster web service.
- Recover video `dezxvbfyv1jy83c` only after the runtime is deployed and verified.

**Non-Goals:**
- Add SSO/SAML or change the signup domain gate.
- Move Cap's primary MySQL database to RDS.
- Enable optional product analytics, billing, referrals, Google Drive storage, WorkOS, or support messenger features.
- Make Replicate required for baseline transcription. Replicate remains optional audio enhancement.
- Rewrite Cap workflow business logic beyond the minimal self-hosting integration needed for Kubernetes.

## Decisions

### Use a PostgreSQL-backed Workflow DevKit world

Cap's `workflow/api` jobs require a workflow world that supplies durable workflow state and queue processing. The design will add `@workflow/world-postgres` and configure:

- `WORKFLOW_TARGET_WORLD=@workflow/world-postgres`
- `WORKFLOW_POSTGRES_URL=<postgres connection string>`
- `WORKFLOW_POSTGRES_JOB_PREFIX=cap_production_`

The app will start the world from Next.js node instrumentation with `getWorld().start?.()` for non-edge runtime. A Kubernetes Job will run `workflow-postgres-setup` during deployment before workload rollout or as an idempotent post-deploy setup step.

Alternatives considered:
- Local world: not acceptable for production because it stores local process/filesystem state and is not durable across pods.
- Vercel world: not applicable because this deployment runs in Kubernetes.
- Cap MySQL: not supported by the Workflow DevKit Postgres world.
- Custom world: unnecessary unless `@workflow/world-postgres` proves incompatible.

### Reuse the existing shared-services Aurora PostgreSQL pattern first

`F:\infrastructure` already creates app-specific PostgreSQL databases and users on the shared-services Aurora PostgreSQL cluster, and the Kubernetes VPC has established PostgreSQL network access. The preferred implementation is a Cap-specific database/user on that cluster with credentials stored in Secrets Manager and mirrored into `cap-runtime`.

If the shared-services reporting cluster is rejected for operational queue state, the fallback is a dedicated low-cost RDS PostgreSQL instance managed by `F:\infrastructure`. The Cap implementation should keep the Helm/env interface the same so that only the Terraform data source changes.

Alternatives considered:
- In-cluster PostgreSQL StatefulSet: faster to create, but it creates another persistence surface inside the app chart and weakens the existing "persistent infra belongs in `F:\infrastructure`" rule.
- Dedicated Aurora/RDS immediately: cleaner ownership, but higher cost and more moving parts for a small workflow queue.

### Pin Workflow Postgres world conservatively

Cap currently depends on `workflow@4.2.0-beta.73`. The closest compatible Postgres world package observed is `@workflow/world-postgres@4.1.0-beta.53`, which depends on the same beta `@workflow/utils` line as the pinned workflow package. The implementation should pin explicitly, build the web image, and validate a real workflow run before merge.

If this package combination fails, the fallback is to either test a newer `@workflow/world-postgres` beta or replace Workflow DevKit usage for desktop finalization with an internal queue. The latter is larger and should be avoided unless compatibility blocks us.

### Keep provider keys in AWS Secrets Manager and expose through Terraform-managed Kubernetes Secret

The provider secret `kubernetes/cap/provider-keys/production` contains:

- `OPENAI_API_KEY`
- `GROQ_API_KEY`
- `DEEPGRAM_API_KEY`
- `REPLICATE_API_TOKEN`

Terraform should read this secret and populate corresponding keys in `cap-runtime`. Helm should reference the Kubernetes Secret for `cap-web` env vars. Values files should only contain non-secret feature configuration.

Generated secrets such as `CRON_SECRET` and any workflow database password should be generated by Terraform and stored in Kubernetes Secret or AWS Secrets Manager as appropriate.

### Add Kubernetes CronJobs for Cap cron routes

The chart should include a configurable CronJob list or explicit CronJob templates. The required CronJob calls:

- `GET http://cap-web/api/cron/finalize-stale-desktop-segments`
- schedule `*/15 * * * *`
- header `Authorization: Bearer $CRON_SECRET`

The `developer-storage` cron should be configurable and disabled by default unless product/billing/developer credits are intentionally enabled. If enabled, it should call `GET http://cap-web/api/cron/developer-storage` on a daily schedule with the same secret.

Cron containers should use a small curl image, restart on failure per Kubernetes job semantics, and avoid logging secret values.

The Helm toggle to enable developer storage billing is `cron.developerStorage.enabled=true`; it remains false in production values for LM-15612.

### Correct the media server webhook URL to the service port

The current chart renders `MEDIA_SERVER_WEBHOOK_URL=http://cap-web:3000`, but the `cap-web` Service exposes port `80` and targets container port `3000`. The correct in-cluster URL is `http://cap-web` or an equivalent service DNS name with port `80`.

The chart should render the webhook URL from the web service helper name rather than hard-coding the container port.

### Recover the stuck video after runtime verification

Video `dezxvbfyv1jy83c` is currently in a `processing` upload row with `source={"type":"desktopSegments"}` and raw S3 segments present. The stale recovery cron only processes `uploading` and `error` rows, so this row may not recover automatically.

After workflow runtime and webhook callback paths are verified with a fresh upload, run a one-time recovery:

1. Confirm `result.mp4` and preview assets still do not exist.
2. Reset or mark the upload state into a retryable state using the existing code path or a carefully scoped SQL update.
3. Trigger `queueDesktopSegmentsFinalization` via an existing API/action if available, or run an admin/reprocess path if it reaches the same workflow.
4. Verify `result.mp4`, preview GIF, transcript, and AI summary are created.

## Risks / Trade-offs

- Workflow package incompatibility -> Pin the closest beta-compatible `@workflow/world-postgres` version, build in CI, and validate a real mux workflow before calling the deployment complete.
- Shared-services Aurora used for operational queueing -> Keep the database/user isolated with a `cap_production_workflow` name and switch to dedicated RDS if shared-services ownership rejects this workload.
- Multiple web replicas could start workflow workers -> Start with one `cap-web` replica or configure worker concurrency deliberately; validate the Postgres world locking behavior before scaling web replicas.
- CronJobs can create duplicate recovery attempts -> Use existing idempotent recovery behavior and set Kubernetes CronJob concurrency policy to `Forbid`.
- Secret rotation requires rollout -> Document the exact AWS Secrets Manager names and require Terraform/app rollout after rotation unless external secret syncing is later introduced.
- Current stuck video may need manual state repair -> Do not mutate that row until the runtime is healthy and the recovery command is scoped to only `dezxvbfyv1jy83c`.
- Replicate can increase cost and latency -> Inject the token but keep baseline success criteria tied to Deepgram and Groq/OpenAI, not audio enhancement.

## Migration Plan

1. Infrastructure PR in `F:\infrastructure`:
   - Add PostgreSQL provider dependency if needed.
   - Create Cap workflow PostgreSQL database/user on the shared-services Aurora cluster or provision dedicated RDS fallback.
   - Store workflow database credentials in Secrets Manager.
   - Read `kubernetes/cap/provider-keys/production`.
   - Add `CRON_SECRET` and provider/workflow keys to `cap-runtime`.
   - Ensure Argo Cap application depends on updated runtime secret and workflow database prerequisites.

2. Cap application PR:
   - Add `@workflow/world-postgres` dependency.
   - Start the workflow world from Next node instrumentation in self-hosted production.
   - Add any environment schema entries required by Workflow DevKit if Cap's env package does not already pass through the variables.

3. Cap Helm PR:
   - Add secret key mappings for provider env vars, workflow env vars, and `CRON_SECRET`.
   - Add the workflow setup Job or hook for `workflow-postgres-setup`.
   - Add the stale desktop segment CronJob.
   - Add optional disabled-by-default developer-storage CronJob.
   - Fix `MEDIA_SERVER_WEBHOOK_URL` to use the service URL.

4. Deploy in order:
   - Merge/apply infrastructure first.
   - Merge Cap app/chart changes.
   - Let GitHub Actions build images and update GitOps values.
   - Let Argo sync.

5. Verification:
   - Confirm `cap-web` env includes provider keys, workflow target, workflow Postgres URL, and cron secret without printing values.
   - Confirm workflow setup job succeeds.
   - Upload a fresh desktop recording.
   - Verify S3 contains `result.mp4` and preview assets.
   - Verify DB source changes to `desktopMP4`.
   - Verify transcript and summary populate.
   - Confirm CronJob history succeeds.

6. Recover stuck video:
   - Run the scoped recovery for `dezxvbfyv1jy83c`.
   - Verify processed objects, DB state, transcript, and summary.

Rollback:
- Disable CronJobs through Helm values if they misbehave.
- Roll back Cap image/chart via Argo if app startup fails.
- Keep the workflow PostgreSQL database intact during rollback to preserve queued state.
- Remove provider env references only after the app is stable on the prior version.

## Open Questions

- Should `developer-storage` cron remain disabled until Stripe/developer credits are intentionally enabled?
- Is the shared-services Aurora PostgreSQL cluster acceptable for Workflow DevKit queue state, or should Cap get a dedicated RDS PostgreSQL instance despite the added cost?
