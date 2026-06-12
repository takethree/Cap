## ADDED Requirements

### Requirement: Automated Take-3 Windows desktop builds
The system SHALL build a Take-3 Windows desktop installer and bundled CLI artifact automatically from accepted changes to the `take-three` branch.

#### Scenario: Push triggers Windows build
- **WHEN** a commit is pushed to the `take-three` branch
- **THEN** GitHub Actions SHALL build the Windows desktop target for the Take-3 distribution
- **AND** the build SHALL include the bundled Cap CLI binary

#### Scenario: Build uses Take-3 server defaults
- **WHEN** the Take-3 desktop workflow builds the Windows artifact
- **THEN** the packaged desktop default server URL SHALL be `https://cap.take3tech.dev`
- **AND** the packaged web URL SHALL be `https://cap.take3tech.dev`

### Requirement: Take-3 desktop fresh installs default to Take-3
The Take-3 desktop application SHALL point fresh installs at `https://cap.take3tech.dev` without requiring user reconfiguration.

#### Scenario: Fresh desktop launch
- **WHEN** a user installs and launches the Take-3 desktop build on a machine with no prior Take-3 desktop settings
- **THEN** the stored desktop server URL SHALL be `https://cap.take3tech.dev`
- **AND** desktop auth, dashboard links, uploads, and API requests SHALL use `https://cap.take3tech.dev`

#### Scenario: User can still override server URL
- **WHEN** a user manually changes the desktop server URL after installing the Take-3 build
- **THEN** desktop API requests SHALL use the manually configured server URL
- **AND** the packaged Take-3 default SHALL remain available as the reset/default value

### Requirement: Take-3 CLI defaults to Take-3
The Take-3 CLI SHALL default to `https://cap.take3tech.dev` when no explicit server override or desktop setting is available.

#### Scenario: CLI resolves server from environment
- **WHEN** `CAP_SERVER_URL` is set before running the Take-3 CLI
- **THEN** the CLI SHALL use the `CAP_SERVER_URL` value as its server URL

#### Scenario: CLI resolves server from desktop settings
- **WHEN** `CAP_SERVER_URL` is not set
- **AND** the Take-3 desktop settings store contains a server URL
- **THEN** the CLI SHALL use the desktop settings server URL

#### Scenario: CLI uses packaged fallback
- **WHEN** `CAP_SERVER_URL` is not set
- **AND** no readable desktop settings server URL exists
- **THEN** the Take-3 CLI SHALL use `https://cap.take3tech.dev`

### Requirement: Take-3 CLI install and update use Take-3 URLs
The Take-3 CLI install and update paths SHALL fetch installers and scripts from the Take-3 distribution channel instead of `https://cap.so`.

#### Scenario: Windows CLI installer downloads Take-3 desktop
- **WHEN** a Windows user runs the CLI installer script served from `https://cap.take3tech.dev/install-cli.ps1`
- **AND** Cap Desktop must be installed or replaced
- **THEN** the script SHALL download the Windows desktop installer from `https://cap.take3tech.dev/download/windows`

#### Scenario: CLI update uses Take-3 script base URL
- **WHEN** a user runs `cap update` from the Take-3 CLI
- **THEN** the update command SHALL invoke a Take-3 installer or update script URL
- **AND** it SHALL NOT invoke `https://cap.so/install-cli.ps1` or `https://cap.so/install-cli.sh`

### Requirement: Durable Take-3 release channel
The system SHALL publish Take-3 desktop artifacts to a durable release channel that can be resolved by the Take-3 web application.

#### Scenario: Successful build publishes durable assets
- **WHEN** a Take-3 Windows desktop build succeeds and is promoted
- **THEN** the installer and updater signature artifacts SHALL be published to a durable release channel
- **AND** a manifest SHALL identify the version, commit SHA, publication date, installer URL, updater URL, and signature

#### Scenario: Download route resolves latest promoted Windows build
- **WHEN** a user requests `https://cap.take3tech.dev/download/windows`
- **THEN** the web application SHALL redirect to or serve the latest promoted Take-3 Windows installer
- **AND** it SHALL NOT redirect to Cap public CrabNebula download URLs

### Requirement: Take-3 updater metadata
The Take-3 desktop updater SHALL check Take-3 updater metadata and install only signed Take-3 update artifacts.

#### Scenario: Desktop checks for updates
- **WHEN** the Take-3 desktop app checks for updates
- **THEN** it SHALL request update metadata from the Take-3 release channel
- **AND** the metadata SHALL describe a signed Take-3 artifact for the requesting platform when an update is available

#### Scenario: Update metadata does not downgrade or reinstall same version
- **WHEN** the Take-3 desktop app is already running the latest promoted version
- **THEN** the updater metadata response SHALL indicate that no newer update is available

### Requirement: Public Cap distribution remains unchanged
The public Cap desktop and CLI distribution SHALL keep its existing public defaults unless explicitly built through the Take-3 distribution path.

#### Scenario: Public build keeps public defaults
- **WHEN** the existing public Cap release workflow builds desktop or CLI artifacts
- **THEN** those artifacts SHALL keep the public Cap server, download, and update defaults configured for that workflow
- **AND** Take-3-specific defaults SHALL NOT leak into the public release channel
