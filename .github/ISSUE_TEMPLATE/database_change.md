---
name: Database Schema Change
about: Propose a change to prisma/schema.prisma (Requires team coordination)
title: '[DB]: '
labels: ['database', 'schema-change']
assignees: ''
---

## Reason for Schema Change

<!-- Why is this change necessary? What feature requires it? -->

## Developer Owner

- [ ] Developer A
- [ ] Developer B
- [ ] Developer C

## Proposed Schema Diff / Additions

```prisma
// Paste proposed model / field additions here
```

## Affected Modules

- [ ] apps/backend
- [ ] apps/web
- [ ] packages/shared-types

## Migration Impact

- [ ] Non-breaking addition (new optional field / new table)
- [ ] Breaking change (required field / column rename / type change)
- [ ] Requires seed data update

## Coordination Checklist

- [ ] Announced to team before applying migration
- [ ] Migration generated (`npx prisma migrate dev --name ...`)
- [ ] `packages/shared-types` updated to match
- [ ] PR created and fast-tracked
