## Context

Cap already has three related but separate concepts:

- `CAP_ALLOWED_SIGNUP_DOMAINS` gates whether a new email domain may sign up.
- `organizations.allowedEmailDomain` restricts public/shared link access by email or domain.
- `organization_members` determines organization membership, while `shared_videos` determines which videos appear in the organization-wide Shared Caps area.

Today, `DrizzleAdapter.createUser` creates a personal organization for new users unless a pending invite exists. Desktop video creation later validates the user's requested or default organization against their memberships and writes the chosen id to `videos.orgId`.

For Take-3, production already restricts signups to `take3tech.com`. The missing behavior is automatically enrolling those new accounts in organization `m0tmhvagbmea7aj` and making that organization the default recording context.

## Goals / Non-Goals

**Goals:**

- Configure trusted email domains that auto-enroll new users into a configured organization.
- Preserve pending invite behavior before applying domain auto-join.
- Set active and default organization ids for auto-joined users.
- Avoid creating a personal organization when an auto-join rule applies.
- Optionally share new recordings to the organization root through `shared_videos` when explicitly enabled.
- Support Take-3 production with `take3tech.com` mapped to `m0tmhvagbmea7aj`.
- Provide a safe backfill path for existing matching users.

**Non-Goals:**

- Replace manual invites or organization role management.
- Treat public-link email restrictions as organization membership.
- Add SSO/SAML or WorkOS organization provisioning.
- Automatically make auto-joined users admins or owners.
- Silently expose existing private or unshared videos without an explicit backfill decision.

## Decisions

### Use explicit auto-join rules instead of reusing `allowedEmailDomain`

Add server configuration for domain-to-organization enrollment, for example:

```text
CAP_AUTO_JOIN_ORGANIZATION_RULES=take3tech.com=m0tmhvagbmea7aj
CAP_AUTO_SHARE_NEW_VIDEOS_TO_ORG_ROOT=false
```

Helm should expose these through chart values and render them into the web environment. Take-3 production values should set the rule for `take3tech.com`; auto-share should be enabled only if the product decision is to put every new recording in the org-wide Shared Caps area.

Alternative considered: reuse `organizations.allowedEmailDomain`. That would conflate public link access with internal membership and could accidentally grant organization membership to domains that were only meant to view links.

### Apply auto-join only during new-user creation

`DrizzleAdapter.createUser` is the narrowest durable point because it already normalizes email, detects pending invites, inserts the user, and creates the fallback personal organization. After inserting the user and confirming there is no pending invite, it should look up a matching auto-join rule.

If a rule matches:

- verify the target organization exists and is not tombstoned
- insert an `organization_members` row with role `member`
- update `users.activeOrganizationId` and `users.defaultOrgId` to the target organization
- skip personal organization creation

If the configured organization is missing or tombstoned, fail closed for the auto-join path and log enough context for operators to fix configuration.

Alternative considered: run this in the sign-in callback. That would duplicate adapter responsibility, make transactional behavior harder, and risk partially created users.

### Keep explicit invites higher priority

Pending invite detection should remain the first branch after user creation. If a matching pending invite exists, keep the existing behavior so the invite acceptance flow controls organization, role, seat assignment, and invite cleanup.

Alternative considered: auto-join first and accept invites later. That creates ambiguous default organization behavior and could bypass the role selected by the inviter.

### Treat org membership and org-wide sharing separately

Auto-joining a user and setting their default org ensures future videos get `videos.orgId = m0tmhvagbmea7aj`. It does not automatically make those videos appear in the organization-wide Shared Caps area because that area reads from `shared_videos`.

If `CAP_AUTO_SHARE_NEW_VIDEOS_TO_ORG_ROOT` is enabled, the desktop video creation path should insert a root `shared_videos` row when it creates a video in an organization selected by the auto-share policy. The insertion should be idempotent with the existing `(videoId, organizationId)` lookup pattern used by manual sharing.

Alternative considered: always insert `shared_videos` for auto-joined users. That would surprise users who expect membership/default org to affect ownership and storage but not broad visibility.

### Backfill through an operator-run script or runbook

Existing users are out of the signup path. Provide a scoped backfill that can:

- find users whose email domain matches configured auto-join rules
- skip users already in the target organization
- insert missing memberships as `member`
- optionally set `activeOrganizationId` and `defaultOrgId`
- optionally share existing videos after an explicit operator decision

The script should support dry-run output before mutation.

## Risks / Trade-offs

- Misconfigured org id could block or misplace new Take-3 signups -> Validate the target organization inside the signup transaction and fail with actionable logs.
- Domain matching can be broader than intended -> Match only the normalized email domain by default, not arbitrary substring or subdomain suffixes.
- Auto-share can expose recordings to all organization members -> Keep auto-share disabled unless explicitly configured and covered by tests.
- Existing users will not be enrolled by the new signup path -> Provide a dry-run backfill path and document the operator decision points.
- Seat/pro entitlement behavior may differ from manual invites -> Auto-joined users should start as plain members without automatic Pro seats unless a later product decision adds seat assignment.

## Migration Plan

1. Add the environment schema and Helm chart values without enabling auto-join by default.
2. Implement and test domain rule parsing and new-user auto-join.
3. Configure Take-3 production with `take3tech.com=m0tmhvagbmea7aj`.
4. Deploy with auto-share disabled first and verify a fresh `take3tech.com` signup lands in the Take-3 organization.
5. Enable auto-share only after confirming the desired visibility model.
6. Run the existing-user backfill in dry-run mode, review the candidate list, then apply if approved.

Rollback is configuration-first: remove the auto-join rule and restart/redeploy the web service. Existing memberships created while enabled should be removed only by an explicit data correction if they were unintended.

## Open Questions

- Should new Take-3 recordings appear automatically in the org-wide Shared Caps root, or is default org membership enough?
- Should existing Take-3 users have their default organization changed, or only receive membership while preserving their current default?
- Should existing Take-3 videos be shared to the org root, left private to their owners, or handled case by case?
