/**
 * memoryExplainer.test.tsx | v1.0.0 | 2026-06-18
 * Tests for T63: MemoryExplainerCard -- content, parameters, pipeline, disclosure.
 */

import { describe, it, expect, vi } from 'vitest'

Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryExplainerCard } from '@/components/MemoryExplainerCard'

describe('MemoryExplainerCard (T63)', () => {
  it('renders without crashing', () => {
    render(<MemoryExplainerCard />)
    expect(screen.getByText(/What memory actually changes/)).toBeInTheDocument()
  })

  it('explains confidenceBias', () => {
    render(<MemoryExplainerCard />)
    expect(screen.getAllByText(/confidenceBias/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/boldly the agent commits/)).toBeInTheDocument()
  })

  it('explains hedgingLevel', () => {
    render(<MemoryExplainerCard />)
    expect(screen.getAllByText(/hedgingLevel/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/pulls its confidence toward 50%/)).toBeInTheDocument()
  })

  it('explains topic calibration', () => {
    render(<MemoryExplainerCard />)
    expect(screen.getByText(/topic calibration/)).toBeInTheDocument()
    expect(screen.getByText(/per-matchup multipliers/)).toBeInTheDocument()
  })

  it('shows the sleep-evolve pipeline', () => {
    render(<MemoryExplainerCard />)
    expect(screen.getByText(/sleep-evolve pipeline/)).toBeInTheDocument()
    expect(screen.getByText(/Trigger check/)).toBeInTheDocument()
    expect(screen.getByText(/Brier error/)).toBeInTheDocument()
  })

  it('shows concrete parameter diff example', () => {
    render(<MemoryExplainerCard />)
    expect(screen.getByText(/Dr\. Morgan/)).toBeInTheDocument()
    expect(screen.getByText(/fromVersion: 0/)).toBeInTheDocument()
  })

  it('explains why deterministic', () => {
    render(<MemoryExplainerCard />)
    expect(screen.getByText(/deterministic by design/)).toBeInTheDocument()
    expect(screen.getByText(/no RNG/)).toBeInTheDocument()
  })

  it('contains the honest synthetic disclosure', () => {
    render(<MemoryExplainerCard />)
    expect(screen.getByText(/hash-derived team strengths/)).toBeInTheDocument()
    expect(screen.getByText(/honest design choice/)).toBeInTheDocument()
  })

  it('has V2 roadmap section', () => {
    render(<MemoryExplainerCard />)
    expect(screen.getByText(/V2 roadmap/)).toBeInTheDocument()
    expect(screen.getByText(/pluggable feature sources/)).toBeInTheDocument()
  })

  it('contains zero Cyrillic', () => {
    render(<MemoryExplainerCard />)
    expect(document.body.textContent ?? '').not.toMatch(/[\u0400-\u04FF]/)
  })
})
