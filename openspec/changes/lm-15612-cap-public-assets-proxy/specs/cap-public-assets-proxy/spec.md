## ADDED Requirements

### Requirement: Public static assets bypass self-host auth redirects
The system SHALL serve public static asset requests without redirecting unauthenticated users to `/login`.

#### Scenario: Web manifest request
- **WHEN** an unauthenticated browser requests `/site.webmanifest` in self-host production mode
- **THEN** the response MUST be a non-redirect manifest response and MUST NOT return login HTML

#### Scenario: Theme script request
- **WHEN** an unauthenticated browser requests `/theme-script.js` in self-host production mode
- **THEN** the response MUST be a non-redirect JavaScript response and MUST NOT return login HTML

#### Scenario: Nested binary asset request
- **WHEN** an unauthenticated browser requests a nested public binary asset such as `/rive/main.riv` in self-host production mode
- **THEN** the response MUST be a non-redirect static asset response and MUST NOT return login HTML

#### Scenario: Icon and image asset request
- **WHEN** an unauthenticated browser requests a public image, icon, or SVG asset in self-host production mode
- **THEN** the response MUST be a non-redirect static asset response and MUST NOT return login HTML

### Requirement: Protected app routes remain protected
The system SHALL preserve self-host authentication redirects for protected application routes that are not public static assets.

#### Scenario: Protected dashboard request
- **WHEN** an unauthenticated browser requests `/dashboard/caps` in self-host production mode
- **THEN** the response MUST redirect to `/login`

#### Scenario: Root app request
- **WHEN** an unauthenticated browser requests `/` in self-host production mode
- **THEN** the response MUST continue to follow the configured self-host route gate behavior

### Requirement: Public workflow and share routes remain available
The system SHALL preserve existing non-auth behavior for workflow endpoints and public share routes while changing static asset handling.

#### Scenario: Workflow route request
- **WHEN** a workflow worker posts to `/.well-known/workflow/v1/flow`
- **THEN** the request MUST reach the workflow route and MUST NOT be redirected to `/login`

#### Scenario: Public share request
- **WHEN** an unauthenticated browser requests a public share route such as `/s/<videoId>`
- **THEN** the route MUST remain reachable according to existing share-page behavior
