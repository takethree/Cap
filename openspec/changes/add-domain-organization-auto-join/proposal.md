## Why

Self-hosted Cap can restrict new signups by email domain, but matching users still receive a personal organization unless they were invited manually. Take-3 needs trusted `take3tech.com` signups to land directly in the Take-3 Technologies organization so team recordings use the shared organization context without manual invites.

## What Changes

- Add configurable domain-to-organization auto-join for newly created users.
- When a new user's verified email matches a configured domain, add them to the configured organization as a `member`.
- Set the matched organization as the user's active and default organization so future recordings are created under that organization.
- Preserve explicit invite handling as the higher-priority path when a pending invite exists for the signing-up email.
- Keep current personal organization creation for users who do not match an auto-join rule.
- Add an explicit configuration-controlled option for whether newly created videos in an auto-join/default organization should also appear in the organization-wide Shared Caps area.
- Add a scoped Take-3 deployment configuration mapping `take3tech.com` to organization `m0tmhvagbmea7aj`.
- Provide a one-time backfill path for existing Take-3 users if operators choose to enroll current accounts.

## Capabilities

### New Capabilities

- `domain-organization-auto-join`: Trusted email domains can automatically enroll new users into a configured organization and optionally share new videos to the organization root.

### Modified Capabilities

- None.

## Impact

- Auth/user creation: `packages/database/auth/drizzle-adapter.ts`, `packages/database/auth/domain-utils.ts`, and related auth tests.
- Environment/configuration: `packages/env/server.ts`, Helm chart values/templates, and Take-3 production values.
- Video creation/sharing: desktop video creation route and `shared_videos` insertion behavior if auto-share is enabled.
- Data operations: optional backfill script or runbook for existing users.
- Tests: unit coverage for domain matching, signup precedence, default organization assignment, and optional shared video insertion.
