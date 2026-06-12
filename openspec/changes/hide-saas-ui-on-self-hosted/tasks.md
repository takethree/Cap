## 1. SaaS Flag Normalization

- [x] 1.1 Identify dashboard and shared UI call sites that read `buildEnv.NEXT_PUBLIC_IS_CAP` for custom-domain, billing, Pro, upgrade, or referral behavior.
- [x] 1.2 Add or reuse a small explicit Cap cloud predicate based on `buildEnv.NEXT_PUBLIC_IS_CAP === "true"` for dashboard UI checks.
- [x] 1.3 Replace relevant truthy `NEXT_PUBLIC_IS_CAP` checks in touched dashboard UI with the explicit predicate.

## 2. Custom Domain UI

- [x] 2.1 Hide the custom-domain status/link row in the sidebar organization header on self-hosted deployments.
- [x] 2.2 Hide the `CustomDomain` settings block on self-hosted deployments.
- [x] 2.3 Adjust the organization settings description so self-hosted deployments do not mention custom domains.
- [x] 2.4 Confirm Cap cloud still shows custom-domain status, setup, verification, and removal flows.

## 3. Commercial Dashboard Surfaces

- [x] 3.1 Hide the sidebar usage/Upgrade to Pro/Cap Pro control on self-hosted deployments.
- [x] 3.2 Hide referral controls in the dashboard topbar, user menu, and sidebar footer on self-hosted deployments.
- [x] 3.3 Ensure the billing and members route shows member management without billing summaries, Pro seat management, or billing-owner notices on self-hosted deployments.
- [x] 3.4 Preserve existing billing, upgrade, Pro seat, and referral behavior on Cap cloud.

## 4. Feature Controls Without Paid-Plan Framing

- [x] 4.1 Remove Pro badges and subscription-only disabled states from organization feature settings on self-hosted deployments.
- [x] 4.2 Remove Pro badges and subscription-only disabled states from shareable link icon settings on self-hosted deployments.
- [x] 4.3 Remove Pro upgrade gating from organization storage integrations on self-hosted deployments while keeping action-level errors intact.
- [x] 4.4 Check other dashboard Pro-gated controls found during search and remove self-hosted paid-plan framing where the underlying feature remains available.

## 5. Verification

- [x] 5.1 Verify self-hosted share-link copy paths use the configured web URL instead of Cap cloud custom-domain or cap.link routing.
- [x] 5.2 Run a scoped Biome check on touched TS/TSX/MD files.
- [x] 5.3 Manually inspect or test key dashboard surfaces with Cap cloud enabled and disabled.
