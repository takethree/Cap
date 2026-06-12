# Take-3 Domain Auto-Join Backfill

Production is configured with:

```text
CAP_AUTO_JOIN_ORGANIZATION_RULES=take3tech.com=m0tmhvagbmea7aj
```

Run a dry run before any mutation:

```bash
pnpm domain-auto-join:backfill
```

Apply membership backfill only:

```bash
pnpm domain-auto-join:backfill -- --apply
```

Apply membership backfill and make Take-3 the active/default organization:

```bash
pnpm domain-auto-join:backfill -- --apply --set-active-default
```

Share existing videos to the Take-3 organization root only after explicit approval:

```bash
pnpm domain-auto-join:backfill -- --apply --set-active-default --share-existing-videos
```

Rollback is manual and should be scoped to the JSON output from the apply run:

- Delete unintended `organization_members` rows for organization `m0tmhvagbmea7aj`.
- Restore previous `users.activeOrganizationId` and `users.defaultOrgId` values if they were changed.
- Delete unintended `shared_videos` rows created by the `--share-existing-videos` run.
