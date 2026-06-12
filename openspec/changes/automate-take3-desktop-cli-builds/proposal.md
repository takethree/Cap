## Why

Take-3 needs Cap Desktop and the bundled Cap CLI to install as clients for `https://cap.take3tech.dev` without asking users to manually change the Cap Server URL. The current desktop release flow is manual and public-Cap oriented, so code changes on the `take-three` branch do not automatically produce downloadable Take-3 client builds.

## What Changes

- Add an automated GitHub Actions build pipeline for Take-3 desktop and CLI artifacts, starting with Windows.
- Build custom desktop artifacts with `VITE_SERVER_URL=https://cap.take3tech.dev` and `NEXT_PUBLIC_WEB_URL=https://cap.take3tech.dev`.
- Make the CLI default server and install/update URLs configurable for Take-3 builds so standalone and bundled CLI usage does not fall back to `https://cap.so`.
- Publish durable Take-3 desktop installer, bundled CLI, and updater metadata artifacts for each promoted build.
- Update Take-3 web download surfaces to direct users to Take-3 artifacts instead of Cap public artifacts.
- Preserve the existing Cap public release pipeline unless a later decision explicitly merges the two channels.

## Capabilities

### New Capabilities
- `take3-desktop-distribution`: Automated custom desktop and CLI build, download, install, and update behavior for the Take-3 self-hosted Cap instance.

### Modified Capabilities

## Impact

- `.github/workflows`: new or adapted workflow for automated Take-3 desktop/CLI builds.
- `apps/desktop`: build-time server URL defaults, updater endpoint configuration, and release config if a separate distribution identity is chosen.
- `apps/cli`: default server fallback and install/update script URL configuration.
- `apps/web`: `/download/*`, CLI installer routes, dashboard user menu download action, and release metadata lookup for Take-3 artifacts.
- GitHub Releases or external artifact storage: durable Windows installer and updater metadata hosting.
- Secrets and signing: Windows signing and Tauri updater signing secrets must be available to the new workflow.
