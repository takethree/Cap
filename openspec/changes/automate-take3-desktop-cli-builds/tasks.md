## 1. Distribution Configuration

- [x] 1.1 Add build-time distribution defaults for the CLI server URL fallback and installer/update base URL while preserving existing public Cap defaults.
- [x] 1.2 Add or document Take-3 desktop build environment values for `NEXT_PUBLIC_WEB_URL`, `NEXTAUTH_URL`, and `VITE_SERVER_URL` as `https://cap.take3tech.dev`.
- [x] 1.3 Decide and implement the Take-3 Windows distribution identity strategy: distinct app identity/product name or same identity with a scoped server URL migration.
- [x] 1.4 Add tests for desktop and CLI default server resolution covering public defaults, Take-3 packaged defaults, environment overrides, and desktop store overrides.

## 2. Automated Windows Build Workflow

- [x] 2.1 Add a Take-3 desktop workflow triggered by pushes to `take-three` and `workflow_dispatch`.
- [x] 2.2 Reuse existing setup, sidecar build, Tauri build, Windows installer signing, and Tauri updater signing steps for `x86_64-pc-windows-msvc`.
- [x] 2.3 Add a monotonic CI build version strategy suitable for desktop updater comparisons.
- [x] 2.4 Upload short-lived workflow artifacts for debugging failed or unpromoted builds.
- [x] 2.5 Fail clearly when required signing or publishing secrets are missing.

## 3. Durable Release Channel

- [x] 3.1 Create a Take-3 release publication step using GitHub Releases or configured external storage.
- [x] 3.2 Publish the Windows installer and updater signature artifacts for promoted builds.
- [x] 3.3 Generate a Take-3 release manifest containing version, commit SHA, publication date, installer URL, updater artifact URL, and signature.
- [x] 3.4 Ensure the release channel can resolve the latest promoted Windows build without depending on expiring workflow artifacts.

## 4. Web Download and Installer Routing

- [x] 4.1 Change the dashboard user menu `Download App` action to open `/download` on the current origin.
- [x] 4.2 Update `/download/windows` to resolve the latest Take-3 Windows installer when running on or configured for `cap.take3tech.dev`.
- [x] 4.3 Update `install-cli.ps1`, `install-cli.cmd`, and the relevant shell installer script URLs to derive Take-3 download and script URLs from the request origin or configured public web URL.
- [x] 4.4 Update the download page CLI command text so Take-3 users copy commands using `https://cap.take3tech.dev`.
- [x] 4.5 Add unit tests for Take-3 download routing and CLI installer script URL generation.

## 5. Updater and CLI Update Behavior

- [x] 5.1 Configure Take-3 desktop updater endpoints to read Take-3 updater metadata instead of CrabNebula public Cap endpoints.
- [x] 5.2 Generate updater metadata compatible with the Take-3 Windows updater artifact and signature.
- [x] 5.3 Update `cap update` so Take-3 CLI builds invoke Take-3 install/update script URLs.
- [x] 5.4 Add tests or script-level assertions that Take-3 CLI update paths do not reference `https://cap.so`.

## 6. Verification

- [x] 6.1 Run scoped Biome checks for touched TS, JS, JSON, CSS, and MD files.
- [ ] 6.2 Run `cargo fmt --all` and targeted `cargo check` for touched Rust crates.
- [ ] 6.3 Run the Take-3 Windows desktop workflow manually or on a test branch and confirm it produces installer and manifest artifacts.
- [ ] 6.4 Install the generated Windows build on a clean Windows machine and verify desktop server URL, auth, dashboard links, upload requests, and CLI upload target `https://cap.take3tech.dev`.
- [ ] 6.5 Verify `/download/windows` and `install-cli.ps1` from `https://cap.take3tech.dev` install the Take-3 build.
- [ ] 6.6 Verify update checking reports no update for the latest build and detects a newer promoted Take-3 build when available.
