## Context

The dashboard sidebar organization selector was originally laid out for an organization name plus a secondary custom-domain status/link row. The self-hosted UI now hides that secondary row, but the expanded selector still has fixed inner height and padding that reserve space for it. The result is a tall, visually loose selector when only the organization name is visible.

The relevant UI lives in `apps/web/app/(org)/dashboard/_components/Navbar/Items.tsx`. It uses `sidebarCollapsed` for collapsed versus expanded layout and `isCapCloud` plus custom-domain state to decide whether the secondary row appears.

## Goals / Non-Goals

**Goals:**
- Make the expanded organization selector compact when no secondary metadata row is rendered.
- Keep the expanded selector balanced when the custom-domain row is rendered.
- Preserve collapsed sidebar sizing and organization switcher behavior.
- Keep the change scoped to dashboard sidebar layout.

**Non-Goals:**
- Changing custom-domain visibility rules.
- Changing organization switcher data, permissions, or popover behavior.
- Redesigning the full dashboard sidebar.
- Changing mobile navigation.

## Decisions

1. Use conditional layout based on whether the secondary row is rendered.

   The selector should not reserve secondary-row height when the row is absent. This keeps the fix tied to the actual rendered content and avoids self-hosted-specific layout branches that could drift from the UI condition.

   Alternative considered: reduce the selector height unconditionally. That would make the self-hosted view compact, but risks crowding Cap cloud when the custom-domain row is visible.

2. Remove or conditionally replace fixed inner height for the expanded text area.

   The current fixed height is the main source of the leftover vertical space. The name-only layout should be content-sized with stable alignment, while the two-line layout can keep enough vertical room through natural content, gap, and padding.

   Alternative considered: set a smaller fixed height for all expanded states. That is brittle because organization names and the secondary row can vary in font rendering and truncation.

3. Verify both deployment modes at the component behavior level.

   The implementation should be checked with the Cap cloud row visible and with the row hidden. If no running browser environment is available, a scoped Biome check is still required for the touched TSX file and the visual verification gap should be reported.

## Risks / Trade-offs

- Cap cloud selector becomes too tight when the custom-domain row is present -> Keep conditional spacing or natural content sizing for the two-line state and inspect that state.
- Text truncation changes for long organization names -> Preserve `min-w-0`, `truncate`, and full-width name row behavior in the expanded state.
- Collapsed sidebar alignment regresses -> Avoid changing collapsed padding, icon size, or wrapper width unless inspection shows it shares the bug.
