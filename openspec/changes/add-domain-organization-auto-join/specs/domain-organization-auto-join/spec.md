## ADDED Requirements

### Requirement: New users auto-join configured organizations by email domain
The system SHALL enroll a newly created user into the configured organization as a `member` when the user's normalized email domain matches an auto-join rule.

#### Scenario: Matching signup joins target organization
- **WHEN** a new user signs up with email `person@take3tech.com`
- **AND** auto-join is configured for `take3tech.com=m0tmhvagbmea7aj`
- **THEN** the system SHALL create an organization membership for that user in organization `m0tmhvagbmea7aj`
- **AND** the membership role SHALL be `member`

#### Scenario: Matching is case-insensitive
- **WHEN** a new user signs up with email `Person@Take3Tech.com`
- **AND** auto-join is configured for `take3tech.com=m0tmhvagbmea7aj`
- **THEN** the system SHALL create an organization membership for the normalized email domain match

#### Scenario: Missing target organization fails safely
- **WHEN** a new user signs up with an email domain that matches an auto-join rule
- **AND** the configured target organization does not exist or is tombstoned
- **THEN** the system SHALL NOT create a personal organization as a fallback for that matched rule
- **AND** the system SHALL surface an operator-actionable failure for the signup path

### Requirement: Explicit invites take precedence over domain auto-join
The system SHALL preserve pending organization invite behavior before applying domain auto-join rules.

#### Scenario: Pending invite skips auto-join
- **WHEN** a new user signs up with an email address that has a pending organization invite
- **AND** the user's email domain also matches an auto-join rule
- **THEN** the system SHALL leave organization enrollment to the invite acceptance flow
- **AND** the system SHALL NOT create an auto-join membership during user creation

### Requirement: Auto-joined users use the target organization by default
The system SHALL set the auto-joined organization as the user's active and default organization.

#### Scenario: Auto-joined user receives active and default organization
- **WHEN** a new user is auto-joined into organization `m0tmhvagbmea7aj`
- **THEN** the system SHALL set `users.activeOrganizationId` to `m0tmhvagbmea7aj`
- **AND** the system SHALL set `users.defaultOrgId` to `m0tmhvagbmea7aj`

#### Scenario: New recording uses default organization
- **WHEN** an auto-joined user creates a desktop recording without explicitly choosing an organization
- **THEN** the system SHALL create the video with `videos.orgId` equal to the user's default organization id

### Requirement: Non-matching users keep the existing personal organization flow
The system SHALL preserve current personal organization creation behavior for new users who do not match an auto-join rule and do not have a pending invite.

#### Scenario: Non-matching signup creates personal organization
- **WHEN** a new user signs up with an email domain that does not match any auto-join rule
- **AND** the user has no pending organization invite
- **THEN** the system SHALL create the user's personal organization using the existing flow
- **AND** the system SHALL make that personal organization the user's active and default organization

### Requirement: Organization-wide video sharing is explicit
The system SHALL share newly created videos to the organization-wide Shared Caps root only when organization auto-share is explicitly enabled.

#### Scenario: Auto-share disabled keeps video out of Shared Caps root
- **WHEN** an auto-joined user creates a new recording in the auto-joined organization
- **AND** organization root auto-share is disabled
- **THEN** the system SHALL NOT create a `shared_videos` row for the new video solely because the user was auto-joined

#### Scenario: Auto-share enabled adds video to Shared Caps root
- **WHEN** an auto-joined user creates a new recording in the auto-joined organization
- **AND** organization root auto-share is enabled
- **THEN** the system SHALL create a root `shared_videos` row for the video and organization
- **AND** the shared row SHALL use the recording owner as `sharedByUserId`

#### Scenario: Auto-share insertion is idempotent
- **WHEN** a video already has a `shared_videos` row for the target organization
- **AND** organization root auto-share runs for that video
- **THEN** the system SHALL NOT create a duplicate organization share

### Requirement: Existing users are enrolled only through an explicit backfill
The system SHALL NOT retroactively change existing users or videos during deployment unless an operator runs the scoped backfill.

#### Scenario: Deploying configuration does not mutate existing users
- **WHEN** auto-join configuration is deployed
- **THEN** the system SHALL NOT automatically create memberships for existing accounts outside the new-user signup path

#### Scenario: Backfill supports dry-run review
- **WHEN** an operator runs the existing-user auto-join backfill in dry-run mode
- **THEN** the system SHALL report matching candidate users and planned membership/default-organization changes without mutating data
