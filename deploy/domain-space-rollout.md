# Domain signup spaces (LM-16549)

For the revised requirement of separate native organizations, use `domain-organization-rollout.md` instead. Do not enable this space-routing approach for that rollout.

This change adds an opt-in domain-to-space assignment under the existing default signup organization. It does not establish an isolation boundary for organization-wide content. Do not enable routing or execute the migration until the access decisions below are approved and verified. No production identifiers or customer membership details belong in this public repository.

## Configuration

Leave `CAP_SIGNUP_DOMAIN_SPACE_MAP` unset until a real private space exists and its ID is recorded privately. Then supply a JSON object such as `{"customer.example":"<live-space-id>"}` through runtime configuration, alongside the existing `CAP_DEFAULT_SIGNUP_ORGANIZATION_ID`. Exact domain matching is case-insensitive; subdomains do not inherit assignment. Other domains keep their current signup behavior. A mapped signup fails transactionally if the organization or private space is missing, belongs to another organization, or has internet collection sharing enabled. Membership role is `member`.

Pending organization invitations continue through the existing invitation workflow and bypass automatic assignment. Inventory and reconcile these separately before rollout; this change does not override invite destinations. Existing accounts are not reassigned on login.

For the Kubernetes chart, use the existing `web.extraEnv` list to inject the JSON string as `CAP_SIGNUP_DOMAIN_SPACE_MAP`. Do not add customer IDs to tracked production values in this public repository. The deployed configuration must remain unset until provisioning and access verification are complete.

## Provisioning and existing-user migration

Create a private configuration file outside the repository containing:

```json
{
  "organizationId": "<existing-organization-id>",
  "spaceId": "<reserved-15-character-space-id>",
  "spaceName": "<approved-space-name>",
  "creatorId": "<existing-organization-admin-id>",
  "domain": "customer.example",
  "sourceSpaceIds": []
}
```

With an authorized `DATABASE_URL` supplied securely, run `node scripts/migrate-domain-space.mjs <private-config.json>` for a read-only dry-run. Output contains counts and target space ID, not emails, names, or user IDs. Review the exact-domain member count against the private inventory, including the two existing customer accounts referenced in the internal ticket. The migration selects all matching members of the specified organization, rather than an embedded customer list.

An operator may add `--apply` only after the rollout decisions and separate live-change authorization. The tool validates the organization, administrator creator, existing target ID/name/privacy, and explicit source spaces before writing. It creates a private, non-public space if absent, adds only missing member rows, preserves existing target roles, and removes ordinary membership only from explicitly supplied real source spaces. Source admins stop the transaction. Repeated runs create no duplicate space or membership. Apply serializes on the organization row and commits all changes together. Retain the same reserved target ID for all runs.

No organization is created; organization membership, active/default organization, onboarding, owned videos, shared videos, folders, and public flags remain untouched. No customer content is moved automatically. The synthetic organization entry is not a real space and cannot be supplied as a source. If no real source spaces exist, keep `sourceSpaceIds` empty; the migration cannot remove the synthetic organization-wide access this way.

## Blocking access decisions

Decide whether customer members may see organization-shared videos and organization-public spaces. Today organization membership grants access to videos in `shared_videos`, including private videos, through `VideosPolicy`, the synthetic organization dashboard entry, and dashboard search. Moving space membership does not revoke that access. If organization-wide content must be hidden, approve and implement a consistent scoped-access policy across dashboard lists/search, folders, direct video pages, API/media/download authorization, and sharing actions before enabling this configuration. Hiding navigation alone is insufficient.

Decide whether existing internet-public video and collection links should remain public. `spaces.privacy` controls organization browsing; `spaces.public` controls public collections; video `public` controls direct links. A private space does not make its videos private. Specify staff/admin management and cross-space access, and whether future invitation acceptance must enforce domain assignment. Those choices can change existing internal-domain behavior and are not inferred here.

## Verification and rollback

Use generic fixtures locally. Verify internal-domain signup with routing configured, exact-domain customer signup, foreign/missing/public target failure with transaction rollback, pending invites, repeat migration, ambiguous target names, and ordinary/admin source memberships. Existing video-policy tests plus the added isolation matrix explicitly demonstrate the organization-share and public-link bypasses; they are characterization tests, not evidence of customer isolation.

Before production acceptance, exercise two customer members, an internal ordinary member, an internal admin, and an anonymous viewer against private/public spaces, organization shares, direct/public links, dashboard search, folder pages, media/download endpoints, and sharing mutations. Capture the results privately against the approved access matrix. Do not claim isolation until every applicable path passes. Record the live space ID only in the internal ticket/configuration after separately approved provisioning.

To stop future assignment, remove `CAP_SIGNUP_DOMAIN_SPACE_MAP`. This does not undo existing memberships. Restore source membership only from the privately retained preflight inventory and approved role decisions; do not delete a populated space or reverse content permissions automatically. No deployment or database mutation is part of this PR workflow.
