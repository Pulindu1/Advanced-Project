# Veridian Secure Portal -- Changelog

## v3.2.1 (2024-03-12)

- [FIX] Resolved session timeout issue for long-running analyst sessions.
- [UI] Updated dashboard layout for improved navigation.

## v3.2.0 (2024-03-01)

- [FEATURE] Added Link Previewer tool for external intelligence report URLs.
- [SECURITY] Reminder: preview endpoint accepts any URL scheme.
             Ticket raised to restrict to http/https only. (unresolved)
- [INFRA] Migrated session storage to internal Redis instance for performance.
          No authentication configured on the store (legacy deployment).

## v3.1.0 (2024-02-15)

- [INFRA] Bootstrap script embedded in user-data for automated provisioning.
          Rotation of internal service addresses pending.
- [INFRA] Cloud metadata endpoints accessible during transition period.
          Lockdown deferred to Q3 pending IAM policy approval.

## v3.0.0 (2024-01-20)

- [MAJOR] Migrated to cloud-hosted infrastructure.
- [FEATURE] Internal blog system for cross-team communication.
- [SECURITY] Admin dashboard restricted to session token header validation.
             Full RBAC integration planned for v3.3.

## v2.5.0 (2023-11-01)

- [SECURITY] Decommissioned legacy VPN access.
- [INFRA] Internal services moved to Docker containerisation.
