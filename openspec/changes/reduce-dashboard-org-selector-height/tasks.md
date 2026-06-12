## 1. Inspect Current Layout

- [x] 1.1 Confirm the organization selector render states for expanded with secondary metadata, expanded without secondary metadata, and collapsed sidebar.
- [x] 1.2 Identify the fixed height, padding, or alignment classes that reserve space when the secondary metadata row is not rendered.

## 2. Implement Layout Adjustment

- [x] 2.1 Update the dashboard sidebar organization selector so the expanded name-only state uses compact content-sized vertical spacing.
- [x] 2.2 Preserve the expanded two-line state spacing when the custom-domain metadata row is rendered.
- [x] 2.3 Preserve collapsed sidebar selector sizing and organization switcher popover behavior.

## 3. Verify

- [x] 3.1 Run `pnpm exec biome check --write apps/web/app/(org)/dashboard/_components/Navbar/Items.tsx`.
- [ ] 3.2 Visually verify the expanded sidebar selector without the metadata row is not overly tall.
- [ ] 3.3 Visually verify the expanded sidebar selector with the metadata row and the collapsed sidebar selector still look correct.
