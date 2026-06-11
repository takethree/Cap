## 1. Infrastructure Secrets And Workflow Database

- [x] 1.1 Create LM-15612 infrastructure branch for Cap runtime changes in `F:\infrastructure`.
- [x] 1.2 Add PostgreSQL provider support to `apps/kubernetes` if required for shared-services Aurora database/user creation.
- [x] 1.3 Add Cap workflow PostgreSQL locals for database name, username, secret name, and connection string.
- [x] 1.4 Create Cap workflow PostgreSQL role, database, connect/create grants, and generated password using the existing shared-services Aurora pattern.
- [x] 1.5 Store Cap workflow PostgreSQL credentials in AWS Secrets Manager with a documented secret name.
- [x] 1.6 Read AWS Secrets Manager secret `kubernetes/cap/provider-keys/production` and decode provider keys without outputting values.
- [x] 1.7 Generate a Terraform-managed `CRON_SECRET`.
- [x] 1.8 Add provider keys, workflow Postgres URL, workflow target settings, workflow job prefix, and cron secret to the `cap-runtime` Kubernetes Secret.
- [x] 1.9 Update Cap Argo CD dependencies so the app sync waits for updated runtime secret and workflow database prerequisites.
- [ ] 1.10 Run Terraform format and a targeted plan for the Kubernetes app stack.

## 2. Cap Application Workflow Runtime

- [x] 2.1 Create LM-15612 Cap branch for app and Helm changes from the `take-three` default branch.
- [x] 2.2 Add `@workflow/world-postgres` with an explicit compatible pinned version.
- [x] 2.3 Start the Workflow DevKit world from Next.js node instrumentation in self-hosted production.
- [x] 2.4 Confirm environment handling passes `WORKFLOW_TARGET_WORLD`, `WORKFLOW_POSTGRES_URL`, and workflow-specific settings to runtime code.
- [x] 2.5 Build or run the narrowest available validation for the web package dependency/runtime change.

## 3. Helm Runtime Wiring

- [x] 3.1 Add runtime secret key names for provider keys, workflow Postgres URL, workflow target settings, and `CRON_SECRET`.
- [x] 3.2 Inject `DEEPGRAM_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, and `REPLICATE_API_TOKEN` into `cap-web` from `cap-runtime`.
- [x] 3.3 Inject `WORKFLOW_TARGET_WORLD`, `WORKFLOW_POSTGRES_URL`, and `WORKFLOW_POSTGRES_JOB_PREFIX` into `cap-web`.
- [x] 3.4 Add an idempotent Kubernetes Job or Helm-managed setup step to run `workflow-postgres-setup`.
- [x] 3.5 Fix `MEDIA_SERVER_WEBHOOK_URL` to use the `cap-web` Kubernetes Service URL on its exposed service port.
- [x] 3.6 Add a configurable CronJob template or explicit stale desktop segments CronJob using `CRON_SECRET`.
- [x] 3.7 Configure the stale desktop segments CronJob for `*/15 * * * *`, `concurrencyPolicy: Forbid`, and `GET http://cap-web/api/cron/finalize-stale-desktop-segments`.
- [x] 3.8 Add an explicit disabled-by-default developer-storage CronJob option and document the value required to enable it.
- [x] 3.9 Render Helm templates locally for production values and inspect `Deployment`, setup `Job`, and `CronJob` output.

## 4. Pull Requests And Deployment Order

- [ ] 4.1 Open infrastructure PR with LM-15612 title, summary, plan output, and secret rotation locations.
- [ ] 4.2 Open Cap PR with LM-15612 title, app changes, Helm changes, and deployment notes.
- [ ] 4.3 Merge/apply infrastructure before Cap chart/app rollout.
- [ ] 4.4 Verify GitHub Actions produces immutable Cap image tags and GitOps values update.
- [ ] 4.5 Verify Argo CD sync applies the new runtime secret, setup job, deployment, and CronJobs.

## 5. Production Verification

- [ ] 5.1 Confirm `cap-web` has the expected env var names without printing secret values.
- [ ] 5.2 Confirm the workflow setup job completes successfully.
- [ ] 5.3 Confirm the stale desktop segment CronJob can run successfully on demand.
- [ ] 5.4 Upload a fresh desktop recording to `https://cap.take3tech.dev`.
- [ ] 5.5 Verify media server logs show a `/video/mux-segments` request for the fresh recording.
- [ ] 5.6 Verify S3 contains `result.mp4` and preview or screenshot artifacts for the fresh recording.
- [ ] 5.7 Verify the fresh recording database row transitions to `desktopMP4` and clears the active upload row.
- [ ] 5.8 Verify transcript generation runs when the recording has audio.
- [ ] 5.9 Verify AI summary generation runs after transcription completes.

## 6. Stuck Video Recovery

- [ ] 6.1 Recheck video `dezxvbfyv1jy83c` DB state and S3 object state before recovery.
- [ ] 6.2 Choose the least invasive recovery path that reuses existing finalization logic.
- [ ] 6.3 Apply a scoped retry/reset only for video `dezxvbfyv1jy83c`.
- [ ] 6.4 Verify the video creates `result.mp4` and preview or screenshot artifacts.
- [ ] 6.5 Verify the video no longer has a stuck `desktopSegments` processing state.
- [ ] 6.6 Verify transcript and AI summary are attempted or completed for the recovered video.
- [ ] 6.7 Record the exact recovery command and result in the PR or deployment notes without exposing secrets.
