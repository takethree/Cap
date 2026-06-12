## Context

Take-3 production web is already deployed from the `take-three` branch to `https://cap.take3tech.dev` through `.github/workflows/deploy-cap-gitops.yml`. Desktop distribution is separate: the existing `.github/workflows/publish.yml` is manual, uses the public Cap release channel, and uploads Tauri artifacts to CrabNebula. The desktop app already reads `VITE_SERVER_URL` as its packaged default server, but the CLI and install/update scripts still contain `https://cap.so` fallbacks.

The desired outcome is a repeatable Take-3 client distribution pipeline. A code change on `take-three` should produce a Windows desktop installer containing the bundled CLI, and that installer should default desktop and CLI traffic to `https://cap.take3tech.dev`. Users should download the custom build through the Take-3 instance instead of following public Cap download links.

## Goals / Non-Goals

**Goals:**
- Build Windows desktop and bundled CLI artifacts automatically from the `take-three` branch.
- Bake `https://cap.take3tech.dev` into the desktop app and CLI distribution defaults.
- Publish durable artifacts and updater metadata that the Take-3 web app can serve or redirect to.
- Keep public Cap release behavior intact.
- Leave a clear path to add macOS and Linux after the Windows lane is working.

**Non-Goals:**
- Rebuild or redeploy the Take-3 web instance itself beyond download/install route changes.
- Change recording, auth, organization, or upload business logic.
- Replace the public Cap release pipeline.
- Solve macOS notarization or Linux package signing in the first phase.

## Decisions

### Create a Take-3-specific desktop build workflow

Add a workflow such as `.github/workflows/take3-desktop-build.yml` triggered by pushes to `take-three`, with `workflow_dispatch` for manual rebuilds. The first matrix target should be `x86_64-pc-windows-msvc`. The workflow should reuse the existing desktop build steps from `publish.yml`: setup JS/Rust, run `cap-setup`, build sidecar binaries, run `pnpm build:tauri --target x86_64-pc-windows-msvc --config src-tauri/tauri.prod.conf.json`, sign the Windows installer, and sign the Tauri updater artifact.

Alternative considered: extend `publish.yml`. That workflow is release-version oriented, manual, and coupled to the public Cap/CrabNebula release channel. A separate workflow keeps Take-3 automation isolated and easier to run on every branch push.

### Use a durable release channel instead of workflow artifacts for downloads

The workflow should publish promoted artifacts to a durable channel that the web app can resolve. The preferred first implementation is GitHub Releases with a Take-3 tag namespace, for example `take3-desktop-${version}+${run_number}` or `take3-desktop-${sha}` plus a movable "latest" lookup in the web app. Release assets should include the Windows installer, updater signature, and a JSON manifest containing version, commit SHA, publication date, asset URLs, and Tauri updater metadata.

Alternative considered: GitHub Actions workflow artifacts. They are useful for job-to-job transfer and short-lived testing, but they are not a stable public distribution source. They can still be uploaded with short retention for debugging.

Alternative considered: S3/CloudFront. This is cleaner long term if Take-3 wants all downloads under AWS-owned infrastructure. It can be added later without changing the desktop/CLI contract as long as the manifest shape stays stable.

### Treat "build every push" and "update every user" as separate concerns

Every push to `take-three` should produce a build artifact. Public download and updater metadata should point at a promoted build. Promotion can initially be automatic for successful Windows builds, but the workflow and manifest should distinguish build identity from app version.

The implementation must decide how to create monotonically increasing desktop versions. If the Tauri package version is unchanged on every push, updater checks may not consider a new artifact installable. The recommended approach is to derive a CI build version from the base Cargo package version plus `github.run_number` or another monotonic component while preserving a human-readable base version.

Alternative considered: require manual version bumps for every client build. That is simpler for update semantics but conflicts with the requested "code change makes a new build" behavior.

### Make client defaults build-time configurable

Desktop should continue to use `VITE_SERVER_URL`, with the Take-3 workflow writing:

```text
NEXT_PUBLIC_WEB_URL=https://cap.take3tech.dev
NEXTAUTH_URL=https://cap.take3tech.dev
VITE_SERVER_URL=https://cap.take3tech.dev
```

The CLI should gain build-time defaults for:
- default upload/server URL fallback
- install script base URL
- update script base URL

For Take-3 builds these values should resolve to `https://cap.take3tech.dev`. The CLI should keep the existing runtime override behavior: `CAP_SERVER_URL` takes precedence, then desktop store server URL, then packaged default.

### Prefer a distinct Take-3 distribution identity if replacement behavior is risky

Existing desktop settings can preserve a stored `serverUrl` even after installing a new build. If Take-3 users may already have public Cap installed, a same-identifier replacement can inherit `https://cap.so` settings and defeat the no-configuration goal. A distinct identifier/product name avoids this by creating a fresh settings store and separate install entry.

Alternative considered: keep the public Cap identifier and add a migration that rewrites `https://cap.so` to `https://cap.take3tech.dev` for Take-3 builds. That makes replacement installs smoother but has a higher risk of surprising users who intentionally configured a different server.

### Route Take-3 download surfaces to Take-3 artifacts

The dashboard user menu "Download App" should use `/download` on the current origin. The `/download/windows` route should resolve the Take-3 release channel when running on `cap.take3tech.dev` or when configured for self-hosted Take-3 distribution. The CLI installer scripts served by the web app should generate commands and internal download URLs from the request origin or configured public web URL, not `https://cap.so`.

## Risks / Trade-offs

- Existing public Cap installs may keep stored `https://cap.so` settings -> Prefer a distinct Take-3 app identity or implement an explicit, narrowly scoped migration.
- Automatic builds with unchanged app versions may not update users -> Add a monotonic CI build version strategy before enabling updater metadata promotion.
- Windows code signing and Tauri update signing secrets may not be available to the new workflow -> Reuse existing signing secret names where possible and document missing secrets as workflow failures.
- GitHub Releases may be convenient but not fully under the Take-3 domain -> Keep the web app as the stable download surface and allow a later swap to S3/CloudFront.
- A bad push could become the public download if promotion is fully automatic -> Start with automatic build artifacts and explicit promotion, or gate latest-channel promotion on checks passing.

## Migration Plan

1. Add configurable CLI and desktop distribution defaults without changing public Cap defaults.
2. Add the Windows-only Take-3 build workflow and verify it produces a signed installer with updater artifacts.
3. Publish artifacts to a Take-3 release channel and generate a manifest.
4. Update the Take-3 web download and CLI installer routes to consume the manifest.
5. Install the generated Windows build on a clean machine and verify desktop settings, auth, upload, dashboard links, CLI upload, and CLI update target `https://cap.take3tech.dev`.
6. Decide whether to promote every successful push automatically or require an explicit promotion step.

Rollback is to point `/download/windows` and CLI installer routes back to the previous behavior while keeping already-generated Take-3 artifacts available for manual testing. If a promoted updater artifact is bad, publish a newer fixed build with a higher version.

## Open Questions

- Should the Take-3 build install as `Cap` or a distinct product such as `Cap - Take3`?
- Should every successful `take-three` push become the latest public download, or should public latest require manual promotion?
- Should durable artifacts live in GitHub Releases for phase one, or should we publish directly to AWS storage used by Take-3 production?
- What exact versioning scheme should be used for CI-produced desktop builds?
