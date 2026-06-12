## 1. Configuration

- [x] 1.1 Add server environment variables for domain auto-join rules and organization-root auto-share.
- [x] 1.2 Add Helm chart values and web deployment environment rendering for the new configuration.
- [x] 1.3 Configure Take-3 production values with `take3tech.com=m0tmhvagbmea7aj`.

## 2. Domain Rule Parsing

- [x] 2.1 Add parsing for normalized `domain=organizationId` auto-join rules.
- [x] 2.2 Add unit tests for exact domain matching, case-insensitive matching, invalid entries, and empty configuration.
- [x] 2.3 Ensure domain auto-join matching remains separate from public-link `allowedEmailDomain` behavior.

## 3. Signup Auto-Join

- [x] 3.1 Update new-user creation to check auto-join rules after pending invite detection.
- [x] 3.2 Validate the configured target organization exists and is not tombstoned before enrolling the user.
- [x] 3.3 Insert the organization membership with role `member` when a rule matches.
- [x] 3.4 Set `activeOrganizationId` and `defaultOrgId` to the matched organization for auto-joined users.
- [x] 3.5 Preserve the existing personal organization creation path for non-matching users.
- [x] 3.6 Preserve pending invite precedence so invite acceptance remains responsible for invited users.

## 4. Video Auto-Share

- [x] 4.1 Add explicit organization-root auto-share detection to the desktop video creation path.
- [x] 4.2 Insert a root `shared_videos` row for new videos only when auto-share is enabled for the selected organization.
- [x] 4.3 Make auto-share insertion idempotent when an organization share already exists.
- [x] 4.4 Verify auto-share disabled leaves new videos out of the Shared Caps root.

## 5. Existing User Backfill

- [x] 5.1 Add a scoped dry-run backfill for existing users matching configured auto-join domains.
- [x] 5.2 Add apply mode to insert missing memberships and optionally set active/default organization ids.
- [x] 5.3 Keep existing video sharing backfill optional and explicit.
- [x] 5.4 Document Take-3 operator steps for dry-run, review, apply, and rollback.

## 6. Verification

- [x] 6.1 Add tests for matching signup auto-joining organization `m0tmhvagbmea7aj` as `member`.
- [x] 6.2 Add tests for pending invite precedence over auto-join.
- [x] 6.3 Add tests for missing or tombstoned configured organization failure.
- [x] 6.4 Add tests that auto-joined users receive active/default organization ids and future recordings use the default org.
- [x] 6.5 Add tests for organization-root auto-share enabled, disabled, and duplicate-share cases.
- [x] 6.6 Run scoped Biome checks for touched TS, JSON, YAML, and MD files.
