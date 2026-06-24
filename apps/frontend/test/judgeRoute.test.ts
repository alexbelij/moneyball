/**
 * judgeRoute.test.ts | v1.0.0 | 2026-06-24
 * Tests for the judge deep-link helpers + store (taken.wal.app/#/judge).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { isJudgeHash, JUDGE_HASH } from '@/lib/judgeRoute'
import { useJudgeStore } from '@/store/judgeStore'

describe('isJudgeHash', () => {
  it('matches the canonical hash', () => {
    expect(isJudgeHash('#/judge')).toBe(true)
    expect(JUDGE_HASH).toBe('#/judge')
  })

  it('is tolerant of slash/case/trailing slash', () => {
    expect(isJudgeHash('#judge')).toBe(true)
    expect(isJudgeHash('#/Judge')).toBe(true)
    expect(isJudgeHash('#/JUDGE/')).toBe(true)
    expect(isJudgeHash('#/judge/')).toBe(true)
  })

  it('rejects sections and unknown hashes', () => {
    expect(isJudgeHash('#/about')).toBe(false)
    expect(isJudgeHash('#/judges')).toBe(false)
    expect(isJudgeHash('#/judge-panel')).toBe(false)
    expect(isJudgeHash('')).toBe(false)
    expect(isJudgeHash(null)).toBe(false)
    expect(isJudgeHash(undefined)).toBe(false)
  })
})

describe('useJudgeStore', () => {
  beforeEach(() => {
    useJudgeStore.setState({ open: false })
  })

  it('opens and closes', () => {
    expect(useJudgeStore.getState().open).toBe(false)
    useJudgeStore.getState().openJudge()
    expect(useJudgeStore.getState().open).toBe(true)
    useJudgeStore.getState().closeJudge()
    expect(useJudgeStore.getState().open).toBe(false)
  })
})
