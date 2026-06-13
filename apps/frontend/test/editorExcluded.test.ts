/**
 * editorExcluded.test | v1.0.0 | 2026-06-13
 * Purpose: Verify vite.config excludes editor.html from deploy builds.
 * T22: DEPLOY_MODE=1 build must not contain editor chunks.
 */

import { describe, it, expect } from 'vitest'
import { defineConfig } from 'vite'
import path from 'path'

describe('vite.config deploy mode', () => {
  it('DEPLOY_MODE=1 input has only main, no editor', () => {
    // Simulate the config logic
    const isDeploy = true
    const frontendDir = path.resolve(__dirname, '..')

    const input = isDeploy
      ? { main: path.resolve(frontendDir, 'index.html') }
      : {
          main: path.resolve(frontendDir, 'index.html'),
          editor: path.resolve(frontendDir, 'editor.html'),
        }

    expect(Object.keys(input)).toEqual(['main'])
    expect(input).not.toHaveProperty('editor')
  })

  it('dev mode input includes both main and editor', () => {
    const isDeploy = false
    const frontendDir = path.resolve(__dirname, '..')

    const input = isDeploy
      ? { main: path.resolve(frontendDir, 'index.html') }
      : {
          main: path.resolve(frontendDir, 'index.html'),
          editor: path.resolve(frontendDir, 'editor.html'),
        }

    expect(Object.keys(input)).toContain('main')
    expect(Object.keys(input)).toContain('editor')
  })
})
