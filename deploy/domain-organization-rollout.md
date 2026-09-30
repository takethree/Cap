# Native organization routing and migration

The revised requirement uses separate native Cap organizations. The earlier domain-to-space approach in `domain-space-rollout.md` is superseded for this rollout. Keep `CAP_SIGNUP_DOMAIN_SPACE_MAP` unset. Organization membership, admin roles, organization shares and future recording `orgId` belong to the user's own organization. No staff account is automatically added to both groups.

## Signup configuration

After approved provisioning, set `CAP_SIGNUP_DOMAIN_ORGANIZATION_MAP` to a JSON object such as `{"customer.example":"<customer-organization-id>"}` using Kubernetes `web.extraEnv`. Leave the existing default signup organization unchanged for other domains. Exact domains match case-insensitively. Missing or tombstoned destinations fail transactionally without creating a personal organization. Do not configure both organization and space routing for the same domain. Mapped-domain invitations to a different organization are rejected at signup, sending, and acceptance; same-organization invitations retain existing roles and behavior.

## Migration inputs

Keep the operator configuration and dry-run output outside this public repository. They contain private inventory identifiers. Supply `DATABASE_URL` securely and run `node scripts/migrate-domain-organization.mjs <private-config.json>` without `--apply` first.

```json
{
  "domain": "customer.example",
  "sourceOrganizationId": "<source-id>",
  "targetOrganizationId": "<reserved-target-id>",
  "targetName": "<approved-name>",
  "ownerId": "<approved-customer-owner-id>",
  "expectedUserIds": ["<reviewed-user-id>"],
  "expectedVideoIds": ["<reviewed-owned-video-id>"],
  "publicLinkPolicy": "<decision-required>",
  "expectedPlanHash": "<reviewed-dry-run-fingerprint>"
}
```

The dry-run uses a read-only transaction. It lists exact matched users and owned videos, including public flags, and reports blockers. Apply requires a reviewed fingerprint matching current data, exact user and owned-video sets, an explicitly approved owner from the matched domain, and an explicit public-link decision. It locks organizations, users and affected records, then creates the target if absent, adds only missing memberships, sets active/default organization, moves only reviewed owned videos and their existing root organization shares, and removes ordinary source membership. Other source videos and organization shares are untouched. It retains video IDs, owners, physical files, bucket references, public flags and sharing status; it does not make unshared videos organization-shared.

Existing target identity/owner and members must match the approved inventory. Source owners/admins, additional organization memberships, storage attachments, user custom buckets, folders, space memberships, created spaces, video space shares, notifications, pending source invitations, and foreign/folder share records stop automatic apply. These require a separately reviewed plan rather than copying data or widening access. Repeating a completed migration adds no memberships and moves no videos; obtain a fresh reviewed fingerprint after any change.

New organizations inherit the source's viewer settings and email restriction for equivalent behavior. They do not copy storage credentials, billing/subscriptions, SSO connections, custom domains, or staff membership. Shared instance storage remains the default; organization isolation does not require copying physical objects. Review the target owner's plan/seat entitlement independently instead of copying another organization's subscription.

## Public-link decision

Native organizations isolate workspace membership and sharing. They do not make internet-public video or collection links organization-private. The migration currently supports only an explicitly approved `publicLinkPolicy: "preserve"`; other values block apply. Do not interpret this as permission to preserve links before the user decides. If all viewing must require same-organization access, implement consistent membership enforcement across video pages, collections, media/downloads, thumbnails, embeds and API access before migrating or enabling routing. This change makes no unsupported privacy decision and does not claim full isolation.

## Rollout and verification

Resolve the owner and public-link decisions, inspect the private inventory, obtain final-head approval/checks for this new PR, deploy through GitOps, and verify running image digests and the actual pod environment. The previous PR's admin-merge authorization does not authorize admin merging this PR. Provision/migrate only after live-change authorization and a current approved dry-run. Configure domain routing only after the target exists. Rerun dry-run after routing activation to catch accounts created during the handoff.

Test both ordinary groups and their own owners/admins: signup, invitation, active/default organization, recording creation, organization/space lists and folders, search, video/media/API authorization, sharing mutations and public-link behavior. A manager in the source organization has no implicit target access. Cross-organization share rows must not grant private-video access or appear in workspace lists. Capture private acceptance evidence without publishing customer identifiers.

Removing the domain map stops future assignment but does not reverse migration. Do not automatically merge organizations back or move all shared content. Use the private preflight inventory and approved data/access policy for any rollback.
