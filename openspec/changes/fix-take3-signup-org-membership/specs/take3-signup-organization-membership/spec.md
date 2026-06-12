## ADDED Requirements

### Requirement: Configured signup organization membership

The system SHALL auto-join new non-invite users to a configured default signup organization when that organization is configured and valid.

#### Scenario: New Take Three signup joins configured organization

- **WHEN** a new user signs up without a pending organization invite and a valid default signup organization is configured
- **THEN** the user is added as a member of the configured organization
- **AND** the user's active organization is set to the configured organization
- **AND** the user's default organization is set to the configured organization
- **AND** no personal signup organization is created for that user

#### Scenario: Public Cap signup remains unchanged

- **WHEN** a new user signs up without a pending organization invite and no default signup organization is configured
- **THEN** the system creates the user's personal organization using the existing signup behavior

#### Scenario: Invalid configured organization falls back safely

- **WHEN** a new user signs up and the configured default signup organization does not exist or is tombstoned
- **THEN** the system MUST NOT add the user to that organization
- **AND** the signup flow uses the existing personal organization behavior or fails with an operator-visible error

### Requirement: Pending invites take precedence

The system SHALL preserve explicit pending organization invite behavior over configured default signup organization behavior.

#### Scenario: Signup with pending invite

- **WHEN** a new user signs up with an email address that has a pending organization invite
- **THEN** the signup flow does not create a personal organization
- **AND** the signup flow does not auto-join the configured default signup organization
- **AND** accepting the invite sets the invited organization as the user's active organization

### Requirement: Organization onboarding is skipped for auto-joined users

The system SHALL mark organization-related onboarding steps complete for users auto-joined to the configured default signup organization.

#### Scenario: Auto-joined user completes welcome step

- **WHEN** an auto-joined user completes the welcome onboarding step
- **THEN** the user is not routed to organization setup
- **AND** the user is not routed to custom domain setup
- **AND** the user is not routed to invite-team setup

#### Scenario: Auto-joined user opens organization setup URL directly

- **WHEN** an auto-joined user directly requests `/onboarding/organization-setup`
- **THEN** the onboarding router redirects the user to the first incomplete non-organization onboarding step

### Requirement: Michael Holifield organization repair

The system SHALL provide a bounded repair path for `mholifield@take3tech.com` that moves him from the accidental signup organization to the Take Three organization.

#### Scenario: Repair preflight finds no accidental organization assets

- **WHEN** the repair preflight finds `mholifield@take3tech.com`, the Take Three organization, and an accidental non-tombstoned personal organization with no attached assets
- **THEN** the repair adds or preserves his membership in the Take Three organization
- **AND** the repair sets his active organization to the Take Three organization
- **AND** the repair sets his default organization to the Take Three organization
- **AND** the repair marks organization-related onboarding steps complete
- **AND** the repair tombstones the accidental personal organization
- **AND** the repair removes his membership row from the accidental personal organization if present

#### Scenario: Repair preflight finds accidental organization assets

- **WHEN** the repair preflight finds videos, shared videos, spaces, folders, or other attached assets for the accidental personal organization
- **THEN** the repair MUST stop before tombstoning the organization
- **AND** the repair MUST report the attached asset counts for manual review or explicit migration

#### Scenario: Repair cannot identify required records

- **WHEN** the repair cannot find the user, the Take Three organization, or a single accidental personal organization to retire
- **THEN** the repair MUST stop without changing organization membership or tombstone state
