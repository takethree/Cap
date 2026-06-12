## Context

Cap self-host mode uses `apps/web/proxy.ts` to redirect unauthenticated requests away from non-public app routes. The current matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `robots.txt`, and `sitemap.xml`, but it still runs for most files in `apps/web/public`.

In production, requests such as `/site.webmanifest`, `/theme-script.js`, `/favicon-32x32.png`, `/android-chrome-192x192.png`, `/safari-pinned-tab.svg`, `/rive/main.riv`, and `/og.png` redirect to `/login`. Browsers then parse login HTML as manifest JSON, JavaScript, image, or Rive binary data. This explains the console failures:

```text
/site.webmanifest -> 307 /login -> HTML parsed as manifest
/theme-script.js  -> 307 /login -> HTML parsed as JavaScript
/rive/main.riv    -> 307 /login -> HTML parsed as Rive binary
```

Next.js Proxy matchers support regular-expression negative matching and the framework documentation explicitly shows excluding static file patterns from proxy execution.

## Goals / Non-Goals

**Goals:**

- Public files served from `apps/web/public` must bypass self-host auth redirects.
- The fix must cover current and future public files without adding a brittle allowlist for every asset.
- Existing protected route behavior must remain intact for unauthenticated users.
- Existing workflow bypass behavior for `/.well-known/workflow/*` must remain intact.
- The change must include regression validation for representative public assets and protected app routes.

**Non-Goals:**

- Redesign Cap authentication or signup domain restrictions.
- Make all marketing pages public in self-host mode.
- Change Cloudflare Tunnel, Argo CD, Kubernetes, or static file hosting infrastructure.
- Change the contents of the manifest, icons, Rive files, or theme script unless a separate asset bug is found.

## Decisions

### Exclude extension-bearing public file requests from the proxy matcher

Update the proxy matcher to skip final path segments that contain a file extension, for example `.*\\.[^/]+$`, while keeping existing exclusions for API routes, Next static assets, image optimization, `favicon.ico`, `robots.txt`, and `sitemap.xml`.

This keeps the auth proxy focused on route-like application paths:

```text
/dashboard/caps       -> proxy runs, auth gate applies
/s/dezxvbfyv1jy83c    -> proxy runs, public share rules apply
/site.webmanifest     -> proxy skipped, static file served
/theme-script.js      -> proxy skipped, static file served
/rive/main.riv        -> proxy skipped, static file served
```

Alternatives considered:

- Explicitly list every public asset path. This is safest for individual known files but brittle because `apps/web/public` already contains many file types and nested folders.
- Add only `site.webmanifest` and `theme-script.js` to the matcher. This fixes the visible console errors but leaves Rive, icons, Open Graph images, media, and future static files vulnerable to the same redirect behavior.
- Add an early `NextResponse.next()` inside `proxy()`. This works, but the proxy still runs for every asset request. Matcher exclusion is simpler and avoids unnecessary proxy work.

### Validate with direct HTTP smoke checks and proxy matcher tests

The implementation should validate at least:

- `/site.webmanifest` returns a non-redirect JSON manifest response.
- `/theme-script.js` returns JavaScript, not HTML.
- `/rive/main.riv` and one image/icon path return non-redirect static responses.
- A protected extensionless app path such as `/dashboard/caps` still redirects unauthenticated users in self-host production mode.
- `/.well-known/workflow/v1/flow` still reaches the workflow route and does not redirect to login.

If the existing test setup can import Next's experimental proxy testing helpers, add a focused unit test for matcher behavior. Otherwise, add the smallest practical route/proxy test available in the repo and rely on production smoke checks after deploy.

## Risks / Trade-offs

- A future protected route with a literal file extension in the final segment would bypass the proxy -> Keep protected downloadable/generated files behind `/api/*` or extensionless app routes, and document this boundary in the spec.
- The matcher regex could accidentally skip `/.well-known/workflow/*` if written as "any dot anywhere" -> Match only final path segments with an extension and retain the explicit workflow bypass in `proxy()`.
- Static assets may still fail if the files are missing from the production image -> Validate representative files against the deployed URL after rollout.
- Browser caches may preserve older redirected responses briefly -> Verify with `curl` and a fresh browser reload after deploy.

## Migration Plan

1. Update `apps/web/proxy.ts` matcher and any helper logic required to bypass public static files.
2. Add focused validation for public static assets and protected route behavior.
3. Run the narrowest applicable checks for touched TypeScript files.
4. Open an LM-15612 Cap PR against `take-three`.
5. After merge, let GitHub Actions publish the image and GitOps update.
6. Confirm Argo syncs successfully.
7. Smoke-test `https://cap.take3tech.dev/site.webmanifest`, `/theme-script.js`, representative images/Rive files, `/dashboard/caps`, and `/.well-known/workflow/v1/flow`.

Rollback:

- Revert the Cap PR if protected app routes stop redirecting correctly.
- Since this is a proxy-only application change, no database or infrastructure rollback is required.

## Open Questions

- Should root marketing assets such as `/og.png` remain public even though the self-host root page redirects to login? The current design says yes because browsers, crawlers, and previews expect asset URLs to be fetchable independently.
