## ADDED Requirements

### Requirement: Self-hosted dashboard hides custom domain management
The dashboard SHALL hide organization custom-domain status, setup, and removal UI when the deployment is not Cap cloud.

#### Scenario: Sidebar organization header on self-hosted
- **WHEN** a user views the dashboard sidebar on a self-hosted deployment
- **THEN** the organization header does not show custom-domain status text, setup prompts, or custom-domain links

#### Scenario: Organization settings on self-hosted
- **WHEN** a user views organization general settings on a self-hosted deployment
- **THEN** custom-domain setup and removal controls are not rendered

#### Scenario: Organization settings description on self-hosted
- **WHEN** a user views organization general settings on a self-hosted deployment
- **THEN** the settings description does not mention custom domains

### Requirement: Self-hosted dashboard hides SaaS commercial surfaces
The dashboard SHALL hide Cap cloud billing, upgrade, referral, and paid-plan promotional UI when the deployment is not Cap cloud.

#### Scenario: Billing and members on self-hosted
- **WHEN** a user views organization billing and members settings on a self-hosted deployment
- **THEN** billing summaries, Pro seat management, and billing-owner notices are not rendered
- **THEN** organization member management remains available

#### Scenario: Sidebar commercial controls on self-hosted
- **WHEN** a user views the dashboard sidebar on a self-hosted deployment
- **THEN** Upgrade to Pro, Cap Pro, and referral controls are not rendered

#### Scenario: User menu on self-hosted
- **WHEN** a user opens the dashboard user menu on a self-hosted deployment
- **THEN** Upgrade to Pro and referral menu items are not rendered

### Requirement: Self-hosted feature controls use non-commercial framing
The dashboard SHALL keep available self-hosted feature controls visible without Cap Pro badges, disabled states, or upgrade prompts that are based only on subscription status.

#### Scenario: Organization feature settings on self-hosted
- **WHEN** a user views organization feature settings on a self-hosted deployment
- **THEN** settings such as transcripts, summaries, chapters, share-page logo visibility, and AI generation language are not labeled as Pro-only
- **THEN** those controls are not disabled solely because the user lacks a Cap cloud subscription

#### Scenario: Organization integrations on self-hosted
- **WHEN** a user views organization integrations on a self-hosted deployment
- **THEN** storage integration controls are not gated by Cap Pro upgrade prompts

#### Scenario: Shareable link icon on self-hosted
- **WHEN** a user views shareable link icon settings on a self-hosted deployment
- **THEN** the setting is not labeled as Pro-only
- **THEN** the control is not disabled solely because the user lacks a Cap cloud subscription

### Requirement: Cap cloud SaaS UI remains unchanged
The dashboard SHALL preserve existing Cap cloud custom-domain, billing, upgrade, referral, and paid-plan UI when the deployment is Cap cloud.

#### Scenario: Cap cloud dashboard
- **WHEN** a user views dashboard surfaces with the Cap cloud deployment flag enabled
- **THEN** Cap cloud custom-domain, billing, upgrade, referral, and paid-plan UI remains available according to existing permissions and subscription state

### Requirement: Self-hosted share links use the configured instance URL
The dashboard SHALL use the configured self-hosted web URL for share links when the deployment is not Cap cloud.

#### Scenario: Copying a share link on self-hosted
- **WHEN** a user copies a cap share link on a self-hosted deployment
- **THEN** the copied URL uses the configured self-hosted web URL
- **THEN** the copied URL does not use Cap cloud custom-domain or cap.link routing
