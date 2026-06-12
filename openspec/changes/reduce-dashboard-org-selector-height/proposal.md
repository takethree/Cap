## Why

The dashboard sidebar organization selector still reserves vertical space for the custom-domain status row after that row is hidden on self-hosted deployments. This makes the selector look too tall and visually unbalanced compared with the one-line content it now contains.

## What Changes

- Tighten the expanded dashboard sidebar organization selector when no secondary metadata row is rendered.
- Preserve the collapsed sidebar organization selector size and behavior.
- Preserve Cap cloud behavior when the custom-domain status/link row is present.
- Keep organization switching, tooltip, popover, and navigation behavior unchanged.

## Capabilities

### New Capabilities
- `dashboard-sidebar-layout`: Defines responsive and conditional layout expectations for dashboard sidebar controls.

### Modified Capabilities

## Impact

- Affected UI is the dashboard sidebar organization selector in `apps/web/app/(org)/dashboard/_components/Navbar/Items.tsx`.
- No public API, database schema, generated file, or dependency changes are expected.
- Verification should include self-hosted/non-Cap-cloud rendering without the custom-domain row and Cap cloud rendering with the row still present.
