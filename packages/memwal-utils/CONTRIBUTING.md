# Contributing to @moneyball/memwal-utils

Thank you for your interest in improving these MemWal utilities.

## Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Type-check
pnpm -C packages/memwal-utils typecheck

# Build (compile TS → dist/)
pnpm -C packages/memwal-utils build
```

## Project structure

```
packages/memwal-utils/
├── src/
│   ├── index.ts        # Public API surface (re-exports)
│   ├── types.ts        # Shared type definitions
│   ├── writeQueue.ts   # MemWalWriteQueue — rate-limited coalescing queue
│   ├── kvOverlay.ts    # KvOverlay — key-value semantics over MemWal
│   └── keyBuilder.ts   # createKeyBuilder — typed key construction
├── package.json
├── tsconfig.json       # Development (noEmit)
├── tsconfig.build.json # Production build (emits to dist/)
├── README.md
└── CONTRIBUTING.md
```

## Design principles

1. **Zero runtime dependencies.** The only peer dependency is the MemWal SDK itself, and it's optional — you can inject any `remember`/`recall` function.

2. **Framework-agnostic.** No Express, no React, no Node-specific APIs. Works in any TypeScript/JavaScript runtime.

3. **Production values documented.** All timing constants, backoff caps, and configuration defaults come from production testing on Walrus mainnet. If you discover better values, please share them.

4. **Type-safe over convenient.** Prefer explicit types and compile-time checks over magic strings and runtime validation.

## Adding a new utility

1. Create `src/yourUtility.ts` with full JSDoc (including `@example` blocks).
2. Export from `src/index.ts`.
3. Add a section to `README.md` with usage examples.
4. Ensure `pnpm typecheck` passes.

## Reporting issues

If you find a bug or have a feature request:

- **MemWal SDK issues** → file on [MystenLabs/MemWal](https://github.com/MystenLabs/MemWal/issues)
- **This package** → file on [anna-stolbovskaja/moneyball](https://github.com/anna-stolbovskaja/moneyball/issues)

## Code style

- Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- ESM only (`"type": "module"`)
- Single quotes, semicolons, 2-space indent
- Every exported symbol has a JSDoc block with `@example`
