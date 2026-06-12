## Context

Take Three production runs from the `take-three` branch at `https://cap.take3tech.dev`, but the web signup path still follows the default Cap organization flow. `packages/database/auth/drizzle-adapter.ts` creates a personal `"My Organization"` for new users who do not have a pending invite, and `packages/web-backend/src/Users/UsersOnboarding.ts` later renames that organization during the welcome step. The onboarding route only checks `users.onboardingSteps`, so a user can already have an organization and still be sent to `/onboarding/organization-setup` if `organizationSetup` is false.

The intended Take Three behavior is closer to an auto-accepted organization invitation: new Take Three users should belong to the existing Take Three organization, skip organization setup, and avoid accidental personal organizations. `mholifield@take3tech.com` already hit the old path and needs a targeted data repair.

## Goals / Non-Goals

**Goals:**

- Add a config-gated signup path that auto-joins new non-invite users to the existing Take Three organization.
- Complete organization-related onboarding flags for auto-joined users so the organization setup, custom domain, and invite-team steps are skipped.
- Preserve explicit invite behavior; a pending invite continues to take precedence over any default signup organization.
- Repair `mholifield@take3tech.com` by moving his active/default organization to Take Three and retiring the accidental personal organization after checking for attached data.
- Keep public Cap and other self-hosted installs on the current personal-organization signup flow unless the default signup organization is configured.

**Non-Goals:**

- Redesign general onboarding UX.
- Change SSO/SAML behavior.
- Add domain-wide email authorization rules for `take3tech.com`.
- Hard-delete organizations or user data.
- Move unrelated existing users or organizations.

## Decisions

### Use explicit configuration for the Take Three organization

Add an optional server-side configuration value for the default signup organization id, set only in the Take Three deployment. Signup code should validate that the configured organization exists and is not tombstoned before using it.

Alternative considered: find the organization by display name such as `Take Three`. That is operationally fragile because names are editable and not unique.

Alternative considered: hard-code the Take Three organization id in code. That would leak deployment-specific data into public Cap code and make local/test environments awkward.

### Treat default-organization signup like an auto-accepted membership

When a default signup organization is configured and the new email does not have a pending invite, create the user, insert an `organization_members` row for the configured organization, set `activeOrganizationId` and `defaultOrgId` to that organization, and set `organizationSetup`, `customDomain`, and `inviteTeam` onboarding flags to true. Do not create `"My Organization"` in this branch.

Alternative considered: keep creating the personal organization but immediately switch the active organization. That leaves unwanted owned organizations visible in the dashboard because dashboard data includes both owned and member organizations.

### Preserve pending invite precedence

The current adapter detects pending invites before creating a personal organization. That ordering should remain: if a pending invite exists, do not auto-join the default Take Three organization during `createUser`; the existing invite acceptance flow should set the invited organization and onboarding flags.

Alternative considered: auto-join Take Three and still allow later invite acceptance. That can briefly put users in the wrong organization and create surprising active/default organization changes.

### Repair Michael with a bounded, auditable data operation

The repair should first inspect the user, the existing Take Three organization, and any non-tombstoned personal organizations owned by `mholifield@take3tech.com`. It should check related rows for the accidental organization before making changes. If the accidental organization has no attached assets, the transaction can insert or keep Take Three membership, set active/default org to Take Three, complete organization onboarding flags, delete the accidental membership row, and set `tombstoneAt` on the accidental organization.

If the accidental organization has videos, shared videos, spaces, folders, or other attached data, the operation should stop and report the counts unless the implementation explicitly migrates those rows to Take Three.

Alternative considered: delete only the `organization_members` row. That is insufficient because the dashboard also loads organizations by `ownerId`.

## Risks / Trade-offs

- Configured organization id points to the wrong org -> Validate the row exists and is not tombstoned, and add a narrow test for the configured path.
- Duplicate membership insert if a row already exists -> Check existing membership or use an idempotent insert strategy.
- Users with pending invites join the wrong org -> Keep pending invite precedence before default organization behavior.
- Michael's accidental org contains assets -> Require an asset-count preflight and stop rather than tombstoning data blindly.
- Onboarding route behavior changes unexpectedly -> Test that a default-org signup skips organization setup while a normal signup still reaches the current flow.

## Migration Plan

1. Add the optional default signup organization configuration and set it in the Take Three deployment to the existing Take Three organization id.
2. Implement and test the config-gated signup branch.
3. Run a read-only preflight for `mholifield@take3tech.com` to identify his user id, current organizations, Take Three organization id, and accidental org asset counts.
4. If the accidental organization is empty, run the repair transaction and verify his active/default org and dashboard organization list.
5. If attached assets exist, decide whether to migrate those rows to Take Three before tombstoning the accidental organization.

Rollback is to unset the default signup organization configuration and redeploy, which returns future signups to the existing personal-organization behavior. The Michael repair should be treated as a deliberate production data change; rollback would require manually restoring the previous organization state from the preflight output.

## Open Questions

- What is the canonical Take Three organization id in production?
- Should Take Three auto-joined users receive the `member` role, or should selected domains/users receive `admin`?
- Should the repair migrate accidental-org assets if any exist, or should it stop for manual review?
