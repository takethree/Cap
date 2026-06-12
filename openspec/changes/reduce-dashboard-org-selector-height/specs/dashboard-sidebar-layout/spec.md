## ADDED Requirements

### Requirement: Organization selector adapts to rendered metadata
The dashboard sidebar organization selector SHALL size and align its expanded layout according to the metadata rows that are actually rendered.

#### Scenario: Expanded selector without secondary metadata
- **WHEN** a user views the expanded dashboard sidebar and the organization selector does not render a secondary metadata row
- **THEN** the selector height fits the organization avatar, organization name, and dropdown indicator without reserving extra vertical space for hidden metadata

#### Scenario: Expanded selector with secondary metadata
- **WHEN** a user views the expanded dashboard sidebar and the organization selector renders a secondary metadata row
- **THEN** the selector retains enough vertical space and alignment for both the organization name row and secondary metadata row

#### Scenario: Collapsed selector remains compact
- **WHEN** a user views the collapsed dashboard sidebar
- **THEN** the organization selector remains compact and centered around the organization avatar

### Requirement: Organization selector preserves existing interaction behavior
The dashboard sidebar organization selector SHALL keep existing organization switching interactions while changing only layout sizing and alignment.

#### Scenario: Opening the organization switcher
- **WHEN** a user activates the organization selector
- **THEN** the organization switcher popover opens with the existing organization search and selection controls

#### Scenario: Long organization names
- **WHEN** a user views an organization with a long name in the expanded dashboard sidebar
- **THEN** the organization name remains truncated within the selector instead of overflowing or changing sidebar width
