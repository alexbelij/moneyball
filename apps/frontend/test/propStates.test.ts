/**
 * propStates.test.ts | v1.0.0 | 2026-06-13
 * Tests for T19: PropStateController state machine transitions.
 * Tests are pure logic (no Phaser scene needed) — we mock the minimal
 * Phaser scene interface and verify state transitions + setTexture calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// GameEventBus mock — we control prop:click events manually
const listeners = new Map<string, Set<Function>>()
vi.mock('@/events/GameEventBus', () => ({
  GameEventBus: {
    on(event: string, fn: Function) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(fn)
    },
    off(event: string, fn: Function) {
      listeners.get(event)?.delete(fn)
    },
    emit(event: string, ...args: any[]) {
      listeners.get(event)?.forEach((fn) => fn(...args))
    },
  },
}))

import { PropStateController } from '@/phaser/world/PropStateController'
import type { PropDef } from '@/phaser/world/propTypes'

/* ── Helpers ────────────────────────────────────────────────────── */

function makeDef(id: string, overrides?: Partial<PropDef>): PropDef {
  return {
    id,
    src: `props/${id}.png`,
    w: 50,
    h: 50,
    x: 100,
    y: 100,
    anchorY: 150,
    interactive: true,
    ...overrides,
  }
}

function mockRef() {
  return { setTexture: vi.fn() }
}

function mockScene(): any {
  const tweens: any[] = []
  const timers: any[] = []
  return {
    add: {
      rectangle: vi.fn().mockReturnValue({
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      }),
    },
    tweens: {
      add: vi.fn((config: any) => {
        tweens.push(config)
        return { remove: vi.fn() }
      }),
    },
    time: {
      delayedCall: vi.fn((delay: number, cb: Function) => {
        const t = { delay, cb, remove: vi.fn() }
        timers.push(t)
        return t
      }),
    },
    _tweens: tweens,
    _timers: timers,
  }
}

function clickProp(propId: string) {
  listeners.get('prop:click')?.forEach((fn) => fn({ propId }))
}

/* ── Tests ──────────────────────────────────────────────────────── */

describe('PropStateController', () => {
  let scene: ReturnType<typeof mockScene>
  let ctrl: PropStateController

  beforeEach(() => {
    listeners.clear()
    scene = mockScene()
    ctrl = new PropStateController(scene)
  })

  describe('exit_sign toggle', () => {
    it('starts in "on" state', () => {
      expect(ctrl.getExitSignState()).toBe('on')
    })

    it('toggles to "off" on click, then back to "on"', () => {
      const def = makeDef('exit_sign', {
        swapStates: { on: 'props/exit_sign_on.png', off: 'props/exit_sign_off.png' },
      })
      const ref = mockRef()
      ctrl.register(def, ref)
      ctrl.start()

      clickProp('exit_sign')
      expect(ctrl.getExitSignState()).toBe('off')
      expect(ref.setTexture).toHaveBeenCalledWith('prop:props/exit_sign_off.png')

      clickProp('exit_sign')
      expect(ctrl.getExitSignState()).toBe('on')
      expect(ref.setTexture).toHaveBeenCalledWith('prop:props/exit_sign_on.png')
    })
  })

  describe('light_switch toggle', () => {
    it('starts in "on" state', () => {
      expect(ctrl.getLightState()).toBe('on')
    })

    it('toggles to "off" on click (dim overlay becomes visible)', () => {
      const def = makeDef('light_switch')
      ctrl.register(def, mockRef())

      const overlay = {
        setVisible: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
      }
      ctrl.setDimOverlay(overlay as any)
      ctrl.start()

      clickProp('light_switch')
      expect(ctrl.getLightState()).toBe('off')
      expect(overlay.setVisible).toHaveBeenCalledWith(true)
    })

    it('toggles back to "on" (dim overlay hides)', () => {
      const def = makeDef('light_switch')
      ctrl.register(def, mockRef())

      const overlay = {
        setVisible: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
      }
      ctrl.setDimOverlay(overlay as any)
      ctrl.start()

      clickProp('light_switch') // off
      clickProp('light_switch') // on
      expect(ctrl.getLightState()).toBe('on')
    })
  })

  describe('coffee_machine brew cycle', () => {
    it('starts idle', () => {
      expect(ctrl.getCoffeeState()).toBe('idle')
    })

    it('transitions to brewing on click', () => {
      const coffeeDef = makeDef('coffee_machine')
      const mugDef = makeDef('mug', { interactive: false, x: 202, y: 496, w: 28, h: 28 })
      ctrl.register(coffeeDef, mockRef())
      ctrl.register(mugDef, mockRef())
      ctrl.start()

      clickProp('coffee_machine')
      expect(ctrl.getCoffeeState()).toBe('brewing')
    })

    it('ignores clicks while brewing', () => {
      const coffeeDef = makeDef('coffee_machine')
      const mugDef = makeDef('mug', { interactive: false })
      ctrl.register(coffeeDef, mockRef())
      ctrl.register(mugDef, mockRef())
      ctrl.start()

      clickProp('coffee_machine')
      expect(ctrl.getCoffeeState()).toBe('brewing')
      clickProp('coffee_machine') // should be ignored
      expect(ctrl.getCoffeeState()).toBe('brewing')
    })

    it('transitions to done after brew timer fires', () => {
      const coffeeDef = makeDef('coffee_machine')
      const mugDef = makeDef('mug', { interactive: false })
      ctrl.register(coffeeDef, mockRef())
      ctrl.register(mugDef, mockRef())
      ctrl.start()

      clickProp('coffee_machine')
      // Brew timer is the first delayedCall
      const brewTimer = scene._timers[0]
      expect(brewTimer.delay).toBe(2000)
      brewTimer.cb() // simulate timer firing
      expect(ctrl.getCoffeeState()).toBe('done')
    })
  })

  describe('cleanup', () => {
    it('destroy() removes prop:click listener', () => {
      ctrl.start()
      expect(listeners.get('prop:click')?.size).toBe(1)
      ctrl.destroy()
      expect(listeners.get('prop:click')?.size ?? 0).toBe(0)
    })
  })
})
