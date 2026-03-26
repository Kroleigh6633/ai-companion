# ADR-0001: SQL Database Naming Convention

**Status**: Accepted
**Date**: 2026-03-26
**Deciders**: Workspace tooling team

---

## Context

We need a consistent naming convention for SQL Server databases across all projects,
environments, and tenants. Without it, databases accumulate with ad-hoc names that
make environment, scope, and ownership unclear.

## Decision

All SQL Server databases follow the pattern:

```
sqldb-{area}-[{tenant/instance}]-{environment}
```

| Segment | Description | Required |
|---------|-------------|----------|
| `sqldb` | Fixed prefix — identifies this as a SQL Server database | Yes |
| `area` | Company/project scope (e.g., `pas`, `crm`, `billing`) | Yes |
| `tenant/instance` | Multi-tenant discriminator or named instance | No |
| `environment` | `dev`, `staging`, `prod` | Yes |

### Examples

| Database name | Interpretation |
|---------------|---------------|
| `sqldb-pas-main-dev` | PAS project, main instance, development |
| `sqldb-pas-main-prod` | PAS project, main instance, production |
| `sqldb-crm-tenant1-staging` | CRM project, tenant1, staging |
| `sqldb-billing-dev` | Billing service, development (no tenant) |

## Consequences

- **Good**: Database names are self-documenting. CI/CD scripts can parse environment from the name.
- **Good**: Blast radius of a migration is immediately clear from the name.
- **Good**: Consistent across SQL Server instances, backup policies, and monitoring dashboards.
- **Neutral**: Names are longer than bare names. Acceptable for the clarity gained.

## Implementation

See `/skill: new-database` — automates creating a database following this convention,
including the migration baseline and connection string registration.

---

*This ADR is stored in the fragment-server as document type `adr`, ID `ADR-0001`.*
