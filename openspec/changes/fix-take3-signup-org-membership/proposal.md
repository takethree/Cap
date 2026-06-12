## Why

New users signing up on the Take Three Cap instance are still being given a personal organization and then routed through organization setup. This conflicts with the intended Take Three deployment model, where new users should land in the shared Take Three organization without creating or configuring their own organization.

The issue has already affected `mholifield@take3tech.com`, who needs to be removed from the accidental signup organization and added to the Take Three organization.

## What Changes

- Auto-place eligible Take Three signups into the existing Take Three organization instead of creating a personal signup organization.
- Mark organization-related onboarding steps complete for users who are auto-joined to Take Three so they do not see organization setup, custom domain, or invite-team onboarding.
- Preserve existing pending invite behavior so invited users still join the invited organization.
- Add a one-off repair path for `mholifield@take3tech.com` that moves him to the Take Three organization, makes that his active/default organization, completes the relevant onboarding flags, and removes or tombstones the accidental signup organization after checking for attached assets.
- Keep public Cap and non-Take Three self-hosted signup behavior unchanged unless explicitly configured for the Take Three organization.

## Capabilities

### New Capabilities

- `take3-signup-organization-membership`: Defines automatic Take Three organization membership during signup and the targeted repair of an accidentally created signup organization.

### Modified Capabilities

None.

## Impact

- Affected signup code includes `packages/database/auth/drizzle-adapter.ts`, where users and default organizations are created.
- Affected onboarding code includes `packages/web-backend/src/Users/UsersOnboarding.ts` and `apps/web/app/(org)/onboarding/[...steps]/layout.tsx`, where organization setup completion is interpreted.
- Affected data includes `users`, `organizations`, `organization_members`, and any asset tables referencing an accidental organization such as `videos`, `shared_videos`, `spaces`, and `folders`.
- Configuration may need a Take Three organization identifier so the deployed app can safely select the correct existing organization without relying on display-name matching.
