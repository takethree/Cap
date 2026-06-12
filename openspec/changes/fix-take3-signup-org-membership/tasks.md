## 1. Configuration

- [x] 1.1 Add an optional server-side default signup organization id configuration value.
- [x] 1.2 Document the Take Three deployment value needed for the existing Take Three organization id.
- [x] 1.3 Add configuration validation or lookup behavior that rejects or ignores missing and tombstoned organization ids safely.

## 2. Signup Membership

- [x] 2.1 Update `packages/database/auth/drizzle-adapter.ts` so pending organization invites still take precedence over default signup organization behavior.
- [x] 2.2 Add the configured default organization signup branch that inserts an `organization_members` row, sets `activeOrganizationId` and `defaultOrgId`, and skips personal organization creation.
- [x] 2.3 Set `organizationSetup`, `customDomain`, and `inviteTeam` onboarding flags for auto-joined users without marking unrelated onboarding steps complete.
- [x] 2.4 Keep the existing personal organization creation path when no valid default signup organization is configured.

## 3. Verification

- [x] 3.1 Add focused tests for signup with no configured default organization preserving the current personal organization behavior.
- [x] 3.2 Add focused tests for signup with a valid configured Take Three organization creating membership and not creating a personal organization.
- [x] 3.3 Add focused tests for pending invite signup proving the invite path is not overridden by the configured default organization.
- [x] 3.4 Add onboarding verification that an auto-joined user does not route to organization setup, custom domain setup, or invite-team setup.
- [x] 3.5 Run `pnpm exec biome check --write` on touched TS, JSON, CSS, and MD files.

## 4. Michael Holifield Repair

- [x] 4.1 Build or prepare a read-only preflight that finds `mholifield@take3tech.com`, the Take Three organization, accidental personal organizations he owns, memberships, and attached asset counts.
- [ ] 4.2 Run the preflight against the target environment and record the user id, Take Three organization id, accidental organization id, and asset counts.
- [ ] 4.3 If the accidental organization has attached assets, stop and decide whether to migrate those rows to Take Three before tombstoning.
- [ ] 4.4 If the accidental organization is empty, run an idempotent transaction that adds or preserves Take Three membership, sets active/default organization, completes organization onboarding flags, removes accidental membership, and tombstones the accidental organization.
- [ ] 4.5 Verify Michael's dashboard organization list and active organization resolve to Take Three after the repair.
