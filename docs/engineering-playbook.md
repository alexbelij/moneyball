# Engineering Playbook (MVP)

## Principles
- Vertical slices first (F-001, F-002, F-003)
- Shared contracts live in packages/shared (socket events, walrus schemas)
- Backend-only writes to Walrus
- No PII in logs and no secrets in repo

## Code style
- TypeScript strict
- No hardcoded secrets
- Validate external inputs via adapters/mappers

## Language & File Headers (Project-wide)

- **All documentation, code comments, and user-facing strings are in English.**
- Every source file we touch must start with a header:

Example:
```ts
/**
 * ModuleName | v0.1.0 | 2026-06-08
 * Purpose: One-line description of the module responsibility.
 */
```

- Legacy files without headers are tracked as technical debt and will be normalized in a dedicated cleanup pass.