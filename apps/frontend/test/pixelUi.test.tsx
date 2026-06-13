/**
 * pixelUi.test.tsx | v1.0.0 | 2026-06-13
 * Tests for T14: PixelModal focus trap, Escape close, overlay click close.
 * PixelButton variant rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PixelButton } from '@/components/ui/PixelButton'
import { PixelModal } from '@/components/ui/PixelModal'

describe('PixelButton', () => {
  it('renders with children text', () => {
    render(<PixelButton>Click me</PixelButton>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('fires onClick', async () => {
    const fn = vi.fn()
    render(<PixelButton onClick={fn}>Go</PixelButton>)
    await userEvent.click(screen.getByRole('button'))
    expect(fn).toHaveBeenCalledOnce()
  })

  it('renders disabled state', () => {
    render(<PixelButton disabled>Nope</PixelButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

describe('PixelModal', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    onClose.mockReset()
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <PixelModal open={false} onClose={onClose} title="Test">
        <p>Content</p>
      </PixelModal>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders dialog when open', () => {
    render(
      <PixelModal open={true} onClose={onClose} title="Test Dialog">
        <p>Body text</p>
      </PixelModal>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Test Dialog')).toBeInTheDocument()
    expect(screen.getByText('Body text')).toBeInTheDocument()
  })

  it('has aria-modal="true"', () => {
    render(
      <PixelModal open={true} onClose={onClose} title="Test">
        <p>X</p>
      </PixelModal>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('closes on Escape key', () => {
    render(
      <PixelModal open={true} onClose={onClose} title="Test">
        <p>X</p>
      </PixelModal>,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on close button click', async () => {
    render(
      <PixelModal open={true} onClose={onClose} title="Test">
        <p>X</p>
      </PixelModal>,
    )
    await userEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on overlay click', () => {
    render(
      <PixelModal open={true} onClose={onClose} title="Test">
        <p>X</p>
      </PixelModal>,
    )
    // The overlay is the presentation div (parent of dialog)
    const overlay = screen.getByRole('dialog').parentElement!
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not close when clicking inside modal', () => {
    render(
      <PixelModal open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </PixelModal>,
    )
    fireEvent.click(screen.getByText('Content'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('traps focus on Tab at last element', () => {
    render(
      <PixelModal open={true} onClose={onClose} title="Test">
        <button>First</button>
        <button>Last</button>
      </PixelModal>,
    )
    const last = screen.getByText('Last')
    last.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    // After Tab from last focusable, focus should wrap to first focusable
    // (Close button is first in the modal)
    const closeBtn = screen.getByLabelText('Close')
    expect(document.activeElement).toBe(closeBtn)
  })
})
