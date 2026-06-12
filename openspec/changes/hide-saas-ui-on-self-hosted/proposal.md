## Why

Self-hosted Cap deployments already run on the operator's chosen instance URL, so SaaS-only custom domain setup, billing, Pro upsells, and referral UI create confusion and dead-end flows. Hiding those surfaces makes the dashboard match the self-hosted product model while preserving the Cap cloud experience.

## What Changes

- Hide organization custom-domain indicators and setup controls when the app is not running as Cap cloud.
- Hide or remove SaaS billing, Pro upgrade, Pro badge, and referral UI from self-hosted dashboard surfaces.
- Treat self-hosted deployments as using their configured web URL for share links instead of presenting custom-domain setup as an organization setting.
- Keep feature settings visible on self-hosted deployments without paid-plan framing when the feature is available in the self-hosted product.
- Standardize SaaS-only UI checks on the explicit Cap cloud flag value.

## Capabilities

### New Capabilities
- `self-hosted-saas-ui-visibility`: Defines which SaaS-specific dashboard surfaces are hidden on self-hosted deployments and which feature controls remain available without paid-plan framing.

### Modified Capabilities

## Impact

- Affected UI includes dashboard sidebar organization header, organization settings general page, billing and members page, user menu/topbar, usage button, feature settings, integrations, and other Pro-gated dashboard controls.
- Share-link generation should continue using the existing self-hosted web URL behavior.
- No database schema, generated files, or public API contract changes are expected.
