/**
 * perfGuard.test.ts | v1.0.0 | 2026-06-18
 * T58: Performance guard — verifies that AgentModal and key sub-components
 * use module-level style constants (not inline object literals), React.memo,
 * and useMemo for derived data. Prevents regression to inline style objects.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SRC = path.resolve(__dirname, '../src/components')

function readComponent(name: string): string {
  return fs.readFileSync(path.join(SRC, name), 'utf-8')
}

describe('T58 performance guard', () => {
  const modal = readComponent('AgentModal.tsx')

  it('AgentModal uses memo from React imports', () => {
    expect(modal).toMatch(/import.*\bmemo\b.*from\s+['"]react['"]/)
  })

  it('AgentModal uses useMemo from React imports', () => {
    expect(modal).toMatch(/import.*\buseMemo\b.*from\s+['"]react['"]/)
  })

  it('PredictionRow is wrapped in React.memo', () => {
    expect(modal).toMatch(/const PredictionRow\s*=\s*memo\(/)
  })

  it('EvolutionRow is wrapped in React.memo', () => {
    expect(modal).toMatch(/const EvolutionRow\s*=\s*memo\(/)
  })

  it('ParamBar is wrapped in React.memo', () => {
    expect(modal).toMatch(/const ParamBar\s*=\s*memo\(/)
  })

  it('Hint is wrapped in React.memo', () => {
    expect(modal).toMatch(/const Hint\s*=\s*memo\(/)
  })

  it('CARD is a module-level constant (not a function)', () => {
    expect(modal).toMatch(/^const CARD:\s*React\.CSSProperties/m)
    // The old `function card()` pattern should be gone
    expect(modal).not.toMatch(/function card\(\)/)
  })

  it('S_DIALOG is a module-level constant', () => {
    expect(modal).toMatch(/^const S_DIALOG:\s*React\.CSSProperties/m)
  })

  it('PredictionsTab uses useMemo for derived data', () => {
    // The reversed items, correct count, perf series should be memoized
    expect(modal).toMatch(/useMemo\(\s*\(\)\s*=>\s*\{[\s\S]*?buildAgentPerfSeries/)
  })

  it('EvolutionTab uses useMemo for reversed items', () => {
    // Match useMemo with .slice().reverse()
    expect(modal).toMatch(/useMemo\(\s*\n?\s*\(\)\s*=>\s*\(data\?\.items/)
  })

  it('EvolutionRow uses useMemo for buildEvolutionStory', () => {
    expect(modal).toMatch(/useMemo\(\(\)\s*=>\s*buildEvolutionStory\(ev\)/)
  })

  it('contains no Cyrillic characters', () => {
    expect(modal).not.toMatch(/[\u0400-\u04FF]/)
  })
})
