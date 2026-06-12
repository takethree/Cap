## Why

The self-hosted Cap auth proxy currently redirects public static assets such as `/site.webmanifest`, `/theme-script.js`, favicons, Rive files, and Open Graph images to `/login`. Browsers then receive login HTML where they expect JSON, JavaScript, images, or binary assets, causing console errors and broken public resources on `https://cap.take3tech.dev`.

## What Changes

- Allow public static asset requests to bypass self-host auth redirects and continue to Next.js static file handling.
- Preserve existing self-host route protection for application pages that should require authentication.
- Preserve existing public routes such as share pages, collection pages, login/signup, download, terms, and workflow well-known endpoints.
- Add focused validation for representative public asset paths so future proxy changes do not regress this behavior.

## Capabilities

### New Capabilities

- `cap-public-assets-proxy`: Defines the self-host proxy behavior for public static asset paths and route protection boundaries.

### Modified Capabilities

## Impact

- `apps/web/proxy.ts`: self-host proxy route matching and/or early bypass logic for public static assets.
- `apps/web/public/**`: representative assets used to validate behavior, including manifest, JavaScript, icons, images, SVG, and Rive files.
- Production Cap at `https://cap.take3tech.dev`: browser console noise should disappear for static asset parse/load failures caused by login redirects.
- GitHub Actions and Argo CD deployment flow for LM-15612 follow-up changes.
