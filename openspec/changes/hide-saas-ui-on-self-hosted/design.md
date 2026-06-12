## Context

The dashboard currently mixes Cap cloud commercial surfaces with self-hosted deployments. Custom domain UI appears in the organization switcher and organization settings even though a self-hosted deployment is already served from the operator's configured `WEB_URL`/`NEXT_PUBLIC_WEB_URL`. Other dashboard areas expose billing, referral, upgrade, Pro badge, and paid-plan gating language that only makes sense on Cap cloud.

The existing environment model already exposes `buildEnv.NEXT_PUBLIC_IS_CAP`. Some call sites treat it as truthy while others compare it to `"true"`, which can make `"false"` behave like Cap cloud in client code.

## Goals / Non-Goals

**Goals:**
- Hide SaaS-only custom domain, billing, referral, upgrade, and paid-plan framing from self-hosted dashboard UI.
- Keep functional self-hosted settings visible, including share-page settings and storage integrations, without presenting them as Cap Pro upsells.
- Preserve current Cap cloud behavior when `buildEnv.NEXT_PUBLIC_IS_CAP === "true"`.
- Use the configured web URL as the self-hosted share domain.

**Non-Goals:**
- Remove custom domain database fields, actions, dialogs, or Cap cloud behavior.
- Change Stripe, billing API, or subscription data models.
- Change public share page rendering except where paid-plan framing is hidden from self-hosted dashboard controls.
- Add a new environment variable for deployment type.

## Decisions

### Use an explicit Cap cloud predicate

Use `buildEnv.NEXT_PUBLIC_IS_CAP === "true"` for SaaS-only UI. This avoids treating the string `"false"` as truthy and aligns with existing strict checks in app routes and some dashboard components.

Alternative considered: continue relying on truthiness. That is smaller per call site, but it preserves an easy-to-miss self-hosted misconfiguration where `"false"` still displays cloud-only UI.

### Hide SaaS surfaces rather than disabling them

Self-hosted users should not see custom-domain setup, billing cards, referral links, upgrade buttons, or Cap Pro labels. These surfaces are either irrelevant or point to unavailable cloud flows.

Alternative considered: leave the UI visible with explanatory text. That would add more copy and still imply that self-hosted operators need a cloud account action to finish setup.

### Keep feature controls available without paid-plan framing

Self-hosted deployments should still be able to configure organization settings, share-page branding, storage integrations, and feature defaults when the underlying capability is available. The self-hosted product model is not subscription-gated in the dashboard.

Alternative considered: hide all Pro-gated feature controls. That would remove useful self-hosted configuration and make self-hosted less capable than the product framing promises.

## Risks / Trade-offs

- Self-hosted deployments with incomplete backend feature configuration could see controls for unavailable integrations or AI features. Mitigation: keep existing action-level error handling and only remove paid-plan framing, not capability-specific validation.
- Some SaaS checks may be missed because the UI has scattered `NEXT_PUBLIC_IS_CAP` usage. Mitigation: search dashboard components for billing, upgrade, Pro, referral, custom domain, and `NEXT_PUBLIC_IS_CAP` during implementation.
- Hiding billing from self-hosted must not affect organization member management. Mitigation: keep the Members page/card visible and only hide billing and seat-management surfaces.
