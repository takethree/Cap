## 1. Proxy Behavior

- [x] 1.1 Update `apps/web/proxy.ts` so public static asset paths with final-segment file extensions bypass self-host auth redirects.
- [x] 1.2 Preserve the existing `/.well-known/workflow/*` bypass and self-host route gate behavior for protected extensionless app routes.
- [x] 1.3 Review representative `apps/web/public` asset paths to confirm the matcher covers manifest, JavaScript, image, SVG, media, font, and Rive assets.

## 2. Validation

- [x] 2.1 Add or update focused proxy tests for public asset bypasses and protected route redirects where the existing test setup supports it.
- [x] 2.2 Run the narrowest applicable formatter/linter for touched TypeScript and test files.
- [x] 2.3 Validate the proxy matcher or route behavior for `/site.webmanifest`, `/theme-script.js`, `/rive/main.riv`, `/favicon-32x32.png`, `/dashboard/caps`, and `/.well-known/workflow/v1/flow`.

## 3. Deployment Verification

- [x] 3.1 Open an LM-15612 Cap PR against `take-three` with the static asset proxy fix.
- [ ] 3.2 After merge, confirm GitHub Actions builds and publishes the Cap image and commits the GitOps tag update.
- [ ] 3.3 Confirm Argo CD syncs the new image and `cap-web` rolls out successfully.
- [ ] 3.4 Smoke-test the deployed public asset URLs and verify they return non-redirect static responses instead of `/login` HTML.
- [ ] 3.5 Smoke-test a protected route and workflow route to confirm auth and workflow behavior did not regress.
