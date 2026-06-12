/**
 * bun-test-runner | v0.1.0 | 2026-06-12
 * Purpose: Run the vitest suites in environments that have bun but no node
 * (vitest's tinypool requires node to fork workers). Provides a minimal
 * vitest-compatible shim (describe/it/expect) via a Bun resolver plugin and
 * imports every test file sequentially.
 *
 * Usage: bun scripts/bun-test-runner.ts
 * CI still uses real vitest (`pnpm test`); this runner is a dev convenience
 * and must stay behavior-compatible for the matchers used in test/.
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

let passed = 0
let failed = 0
const failures: string[] = []
const stack: string[] = []

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a instanceof Set && b instanceof Set) {
    return a.size === b.size && [...a].every((v) => b.has(v))
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

function makeExpect(actual: unknown, msg?: string) {
  const label = () => (msg ? ` [${msg}]` : '')
  const fail = (what: string) => {
    throw new Error(`${what}${label()} — got ${JSON.stringify(actual)}`)
  }
  return {
    toBe: (e: unknown) => { if (!Object.is(actual, e)) fail(`expected ${JSON.stringify(e)}`) },
    toEqual: (e: unknown) => { if (!deepEqual(actual, e)) fail(`expected deep-equal ${JSON.stringify(e instanceof Set ? [...e] : e)}`) },
    toContain: (e: unknown) => {
      const ok = Array.isArray(actual) ? actual.includes(e) : typeof actual === 'string' && actual.includes(String(e))
      if (!ok) fail(`expected to contain ${JSON.stringify(e)}`)
    },
    toBeDefined: () => { if (actual === undefined) fail('expected defined') },
    toBeGreaterThan: (e: number) => { if (!(Number(actual) > e)) fail(`expected > ${e}`) },
    toBeGreaterThanOrEqual: (e: number) => { if (!(Number(actual) >= e)) fail(`expected >= ${e}`) },
    toBeLessThan: (e: number) => { if (!(Number(actual) < e)) fail(`expected < ${e}`) },
    toBeLessThanOrEqual: (e: number) => { if (!(Number(actual) <= e)) fail(`expected <= ${e}`) },
    toMatch: (re: RegExp | string) => {
      const ok = typeof actual === 'string' && (typeof re === 'string' ? actual.includes(re) : re.test(actual))
      if (!ok) fail(`expected to match ${re}`)
    },
  }
}

const queue: Array<() => Promise<void>> = []

const shim = {
  describe: (name: string, fn: () => void) => {
    stack.push(name)
    fn()
    stack.pop()
  },
  it: (name: string, fn: () => void | Promise<void>) => {
    const full = [...stack, name].join(' › ')
    queue.push(async () => {
      try {
        await fn()
        passed++
        console.log(`  ✓ ${full}`)
      } catch (err) {
        failed++
        failures.push(`${full}: ${(err as Error).message}`)
        console.error(`  ✗ ${full}\n    ${(err as Error).message}`)
      }
    })
  },
  expect: makeExpect,
}

Bun.plugin({
  name: 'vitest-shim',
  setup(build) {
    build.module('vitest', () => ({ exports: shim, loader: 'object' }))
  },
})

const testDir = join(import.meta.dir, '..', 'test')
const files = readdirSync(testDir).filter((f) => f.endsWith('.test.ts')).sort()
for (const f of files) {
  console.log(`\n${f}`)
  await import(join(testDir, f))
  // run tests registered by this file before importing the next
  for (const job of queue.splice(0)) await job()
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failures.length) process.exit(1)
