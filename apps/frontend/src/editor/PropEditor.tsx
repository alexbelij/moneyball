/**
 * PropEditor | v1.0.0 | 2026-06-13
 * Purpose: Standalone prop constructor page for the room owner.
 * T22: Canvas + asset palette + layers panel + export.
 * Internal dev tool — design-spec does NOT apply.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorProp, PropsJsonSchema } from './types'
import {
  importPropsJson,
  exportPropsJson,
  reorderZ,
  nudge,
  generateId,
  extractFilename,
  type NudgeDir,
} from './logic'

/* ── Constants ───────────────────────────────────────────────────────── */

const BG_W = 1672
const BG_H = 941
const BG_SRC = '/assets/backgrounds/room_bg_v02_table_clock_pennant.png'
const PROPS_JSON_URL = '/assets/props/props.json'
const LS_KEY = 'moneyball-editor-state'

/* ── Asset manifest (built from import.meta.glob at dev time) ────────── */

const propGlob = import.meta.glob<string>(
  '/public/assets/props/*.png',
  { eager: true, query: '?url', import: 'default' },
)
const charGlob = import.meta.glob<string>(
  '/public/assets/characters/**/*.png',
  { eager: true, query: '?url', import: 'default' },
)

/** All repo PNGs available in the asset palette. */
function buildAssetList(): { path: string; url: string; filename: string; group: string }[] {
  const items: { path: string; url: string; filename: string; group: string }[] = []
  for (const [key, url] of Object.entries(propGlob)) {
    const filename = key.split('/').pop() || key
    // Relative to /assets/: "props/<filename>"
    const path = `props/${filename}`
    items.push({ path, url, filename, group: 'Props' })
  }
  for (const [key, url] of Object.entries(charGlob)) {
    const parts = key.split('/')
    const filename = parts.pop() || key
    const path = key.replace('/public/assets/', '')
    items.push({ path, url, filename, group: 'Characters' })
  }
  return items
}

/* ── LocalStorage helpers ────────────────────────────────────────────── */

function saveState(props: EditorProp[]): void {
  try {
    // Strip objectUrl before saving (non-serializable)
    const clean = props.map(({ objectUrl, ...rest }) => rest)
    localStorage.setItem(LS_KEY, JSON.stringify(clean))
  } catch { /* quota */ }
}

function loadState(): EditorProp[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as EditorProp[]
  } catch { return null }
}

/* ── Component ───────────────────────────────────────────────────────── */

export function PropEditor() {
  const [props, setProps] = useState<EditorProp[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState<1 | 2>(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 })
  const [dragInfo, setDragInfo] = useState<{ id: string; startX: number; startY: number; propX: number; propY: number } | null>(null)
  const [repoDoc, setRepoDoc] = useState<PropsJsonSchema | null>(null)
  const [assetFilter, setAssetFilter] = useState('')
  const canvasRef = useRef<HTMLDivElement>(null)

  const assets = useMemo(() => buildAssetList(), [])

  // Load repo props.json on mount
  useEffect(() => {
    fetch(PROPS_JSON_URL)
      .then((r) => r.json())
      .then((doc: PropsJsonSchema) => {
        setRepoDoc(doc)
        // Check localStorage for saved state
        const saved = loadState()
        if (saved && saved.length > 0) {
          setProps(saved)
        } else {
          setProps(importPropsJson(doc))
        }
      })
      .catch(console.error)
  }, [])

  // Autosave on change
  useEffect(() => {
    if (props.length > 0) saveState(props)
  }, [props])

  const selected = useMemo(() => props.find((p) => p.id === selectedId) ?? null, [props, selectedId])

  /* ── Asset image URL resolver ──────────────────────────────────────── */

  const getImageUrl = useCallback(
    (prop: EditorProp): string => {
      if (prop.objectUrl) return prop.objectUrl
      // Try glob-resolved URL first
      const globKey = `/public/assets/${prop.src}`
      const fromGlob = propGlob[globKey] ?? charGlob[globKey]
      if (fromGlob) return fromGlob
      // Fallback to direct URL
      return `/assets/${prop.src}`
    },
    [],
  )

  /* ── Place asset from palette ──────────────────────────────────────── */

  const placeAsset = useCallback(
    (path: string, filename: string, isUploaded: boolean, objectUrl?: string) => {
      const img = new Image()
      const src = isUploaded ? objectUrl! : `/assets/${path}`
      img.onload = () => {
        const newProp: EditorProp = {
          id: generateId(filename),
          src: path,
          x: Math.round(BG_W / 2 - img.naturalWidth / 2),
          y: Math.round(BG_H / 2 - img.naturalHeight / 2),
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
          scale: 1,
          flipX: false,
          visible: true,
          locked: false,
          zIndex: props.length,
          filename,
          isUploaded,
          objectUrl,
          _passthrough: {},
        }
        setProps((prev) => [...prev, newProp])
        setSelectedId(newProp.id)
      }
      img.src = src
    },
    [props.length],
  )

  /* ── File upload ───────────────────────────────────────────────────── */

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files) return
      for (const file of Array.from(files)) {
        const objectUrl = URL.createObjectURL(file)
        placeAsset(`props/${file.name}`, file.name, true, objectUrl)
      }
      e.target.value = ''
    },
    [placeAsset],
  )

  /* ── Prop mutation helpers ─────────────────────────────────────────── */

  const updateProp = useCallback(
    (id: string, patch: Partial<EditorProp>) => {
      setProps((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    },
    [],
  )

  const deleteProp = useCallback(
    (id: string) => {
      setProps((prev) => prev.filter((p) => p.id !== id))
      if (selectedId === id) setSelectedId(null)
    },
    [selectedId],
  )

  const duplicateProp = useCallback(
    (id: string) => {
      const orig = props.find((p) => p.id === id)
      if (!orig) return
      const dup: EditorProp = {
        ...orig,
        id: generateId(orig.filename),
        x: orig.x + 20,
        y: orig.y + 20,
        zIndex: props.length,
        _passthrough: { ...orig._passthrough },
      }
      setProps((prev) => [...prev, dup])
      setSelectedId(dup.id)
    },
    [props],
  )

  /* ── Canvas mouse handlers ─────────────────────────────────────────── */

  const canvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        // Middle-click or Alt+click = pan
        setIsPanning(true)
        setPanStart({ x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y })
        return
      }
    },
    [pan],
  )

  const canvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({
          x: panStart.panX + (e.clientX - panStart.x),
          y: panStart.panY + (e.clientY - panStart.y),
        })
        return
      }
      if (dragInfo) {
        const dx = (e.clientX - dragInfo.startX) / zoom
        const dy = (e.clientY - dragInfo.startY) / zoom
        updateProp(dragInfo.id, {
          x: Math.round(dragInfo.propX + dx),
          y: Math.round(dragInfo.propY + dy),
        })
      }
    },
    [isPanning, panStart, dragInfo, zoom, updateProp],
  )

  const canvasMouseUp = useCallback(() => {
    setIsPanning(false)
    setDragInfo(null)
  }, [])

  const propMouseDown = useCallback(
    (e: React.MouseEvent, prop: EditorProp) => {
      e.stopPropagation()
      if (prop.locked) {
        setSelectedId(prop.id)
        return
      }
      setSelectedId(prop.id)
      setDragInfo({
        id: prop.id,
        startX: e.clientX,
        startY: e.clientY,
        propX: prop.x,
        propY: prop.y,
      })
    },
    [],
  )

  /* ── Keyboard shortcuts ────────────────────────────────────────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selected) return
      if (selected.locked) return

      const dirMap: Record<string, NudgeDir> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      }
      const dir = dirMap[e.key]
      if (dir) {
        e.preventDefault()
        const [nx, ny] = nudge(selected.x, selected.y, dir, e.shiftKey)
        updateProp(selected.id, { x: nx, y: ny })
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteProp(selected.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected, updateProp, deleteProp])

  /* ── Export ─────────────────────────────────────────────────────────── */

  const doExport = useCallback(() => {
    if (!repoDoc) return null
    return exportPropsJson(props, repoDoc.base, repoDoc.note)
  }, [props, repoDoc])

  const copyJson = useCallback(() => {
    const result = doExport()
    if (!result) return
    const text = JSON.stringify(result.json, null, 1)
    navigator.clipboard.writeText(text).catch(console.error)
    alert(`Copied! ${result.new_files.length > 0 ? `New files: ${result.new_files.join(', ')}` : ''}`)
  }, [doExport])

  const downloadJson = useCallback(() => {
    const result = doExport()
    if (!result) return
    const text = JSON.stringify(result.json, null, 1)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'props.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [doExport])

  const resetToRepo = useCallback(() => {
    if (!repoDoc) return
    if (!confirm('Reset all props to repo state? This will discard all changes.')) return
    localStorage.removeItem(LS_KEY)
    setProps(importPropsJson(repoDoc))
    setSelectedId(null)
  }, [repoDoc])

  /* ── Z-reorder via drag in layers panel ────────────────────────────── */

  const [layerDragId, setLayerDragId] = useState<string | null>(null)

  const onLayerDragStart = useCallback((e: React.DragEvent, id: string) => {
    setLayerDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const onLayerDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault()
      if (!layerDragId || layerDragId === targetId) return
      const sorted = [...props].sort((a, b) => b.zIndex - a.zIndex) // layers panel: top=front
      const targetIdx = sorted.findIndex((p) => p.id === targetId)
      if (targetIdx === -1) return
      // Convert panel index (reversed) to z-index
      const newZIndex = sorted.length - 1 - targetIdx
      setProps(reorderZ(props, layerDragId, newZIndex))
      setLayerDragId(null)
    },
    [props, layerDragId],
  )

  /* ── Sorted props for rendering ────────────────────────────────────── */

  const sortedProps = useMemo(
    () => [...props].sort((a, b) => a.zIndex - b.zIndex),
    [props],
  )

  const layersSorted = useMemo(
    () => [...props].sort((a, b) => b.zIndex - a.zIndex),
    [props],
  )

  const filteredAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          !assetFilter ||
          a.filename.toLowerCase().includes(assetFilter.toLowerCase()),
      ),
    [assets, assetFilter],
  )

  /* ── Render ────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      {/* ── Left: Asset Palette ─────────────────────────────────────── */}
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Asset Palette</h3>
        <input
          type="text"
          placeholder="Filter assets…"
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
          style={styles.input}
          aria-label="Filter assets"
        />

        <div style={{ marginBottom: 8 }}>
          <label htmlFor="upload-input" style={styles.label}>Upload PNGs:</label>
          <input
            id="upload-input"
            type="file"
            multiple
            accept="image/png"
            onChange={handleUpload}
            style={{ fontSize: 12, marginTop: 2 }}
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <button onClick={resetToRepo} style={styles.btnSmall} aria-label="Reset to repo state">
            Reset to repo state
          </button>
        </div>

        <div style={styles.assetList}>
          {filteredAssets.map((a) => (
            <div
              key={a.path}
              style={styles.assetItem}
              onClick={() => placeAsset(a.path, a.filename, false)}
              role="button"
              tabIndex={0}
              aria-label={`Place ${a.filename}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') placeAsset(a.path, a.filename, false)
              }}
            >
              <img
                src={a.url}
                alt={a.filename}
                style={{ maxWidth: 40, maxHeight: 40, imageRendering: 'pixelated' }}
              />
              <span style={{ fontSize: 11, wordBreak: 'break-all' }}>
                {a.filename}
                <br />
                <span style={{ color: '#888', fontSize: 10 }}>{a.group}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Center: Canvas ──────────────────────────────────────────── */}
      <div
        style={styles.canvasArea}
        onMouseDown={canvasMouseDown}
        onMouseMove={canvasMouseMove}
        onMouseUp={canvasMouseUp}
        onMouseLeave={canvasMouseUp}
        ref={canvasRef}
      >
        {/* Toolbar */}
        <div style={styles.toolbar}>
          <button
            onClick={() => { setZoom(zoom === 1 ? 2 : 1); setPan({ x: 0, y: 0 }) }}
            style={styles.btnSmall}
            aria-label="Toggle zoom"
          >
            Zoom: x{zoom}
          </button>
          <button onClick={copyJson} style={styles.btnSmall} aria-label="Copy JSON to clipboard">
            Copy JSON
          </button>
          <button onClick={downloadJson} style={styles.btnSmall} aria-label="Download props.json">
            Download props.json
          </button>
          <span style={{ fontSize: 11, color: '#888' }}>
            {props.length} props | {props.filter((p) => p.isUploaded).length} uploaded
          </span>
        </div>

        {/* Canvas viewport */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: pan.x,
              top: pan.y,
              width: BG_W * zoom,
              height: BG_H * zoom,
              imageRendering: 'pixelated' as const,
            }}
          >
            <img
              src={BG_SRC}
              alt="Room background"
              style={{
                width: BG_W * zoom,
                height: BG_H * zoom,
                imageRendering: 'pixelated',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
              draggable={false}
            />
            {sortedProps
              .filter((p) => p.visible)
              .map((p) => (
                <div
                  key={p.id}
                  style={{
                    position: 'absolute',
                    left: p.x * zoom,
                    top: p.y * zoom,
                    width: p.naturalW * p.scale * zoom,
                    height: p.naturalH * p.scale * zoom,
                    outline: selectedId === p.id ? '2px solid #00ff88' : 'none',
                    cursor: p.locked ? 'not-allowed' : 'move',
                    zIndex: p.zIndex,
                    transform: p.flipX ? 'scaleX(-1)' : undefined,
                    opacity: p.locked ? 0.7 : 1,
                  }}
                  onMouseDown={(e) => propMouseDown(e, p)}
                >
                  <img
                    src={getImageUrl(p)}
                    alt={p.id}
                    draggable={false}
                    style={{
                      width: '100%',
                      height: '100%',
                      imageRendering: 'pixelated',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  />
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── Right: Layers + Properties ──────────────────────────────── */}
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Layers</h3>
        <div style={styles.layerList}>
          {layersSorted.map((p) => (
            <div
              key={p.id}
              draggable
              onDragStart={(e) => onLayerDragStart(e, p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onLayerDrop(e, p.id)}
              onClick={() => setSelectedId(p.id)}
              style={{
                ...styles.layerItem,
                background: selectedId === p.id ? '#2a3a4a' : 'transparent',
                opacity: p.visible ? 1 : 0.4,
              }}
              role="option"
              aria-selected={selectedId === p.id}
              aria-label={`Layer ${p.id}`}
            >
              <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.id}
                {p.isUploaded && <span style={{ color: '#e8a44a', marginLeft: 4 }}>(uploaded)</span>}
              </span>
              <span style={{ fontSize: 10, color: '#666' }}>{p.filename}</span>
            </div>
          ))}
        </div>

        {/* ── Properties panel ──────────────────────────────────────── */}
        {selected && (
          <div style={{ marginTop: 8, borderTop: '1px solid #333', paddingTop: 8 }}>
            <h4 style={{ fontSize: 12, marginBottom: 6 }}>Properties: {selected.id}</h4>
            <div style={styles.propGrid}>
              <label htmlFor="prop-x" style={styles.label}>X:</label>
              <input
                id="prop-x"
                type="number"
                value={selected.x}
                onChange={(e) => updateProp(selected.id, { x: parseInt(e.target.value) || 0 })}
                style={styles.numInput}
              />
              <label htmlFor="prop-y" style={styles.label}>Y:</label>
              <input
                id="prop-y"
                type="number"
                value={selected.y}
                onChange={(e) => updateProp(selected.id, { y: parseInt(e.target.value) || 0 })}
                style={styles.numInput}
              />
              <label htmlFor="prop-scale" style={styles.label}>Scale:</label>
              <input
                id="prop-scale"
                type="number"
                step="0.1"
                value={selected.scale}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!isNaN(v)) updateProp(selected.id, { scale: v })
                }}
                style={{
                  ...styles.numInput,
                  ...(selected.scale !== Math.floor(selected.scale) ? { borderColor: '#e8a44a' } : {}),
                }}
              />
              <label style={styles.label}>Size:</label>
              <span style={{ fontSize: 11, color: '#aaa' }}>
                {selected.naturalW}×{selected.naturalH}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              <button onClick={() => updateProp(selected.id, { flipX: !selected.flipX })} style={styles.btnSmall} aria-label="Toggle flip X">
                Flip-X: {selected.flipX ? 'ON' : 'OFF'}
              </button>
              <button onClick={() => updateProp(selected.id, { visible: !selected.visible })} style={styles.btnSmall} aria-label="Toggle visibility">
                {selected.visible ? 'Hide' : 'Show'}
              </button>
              <button onClick={() => updateProp(selected.id, { locked: !selected.locked })} style={styles.btnSmall} aria-label="Toggle lock">
                {selected.locked ? 'Unlock' : 'Lock'}
              </button>
              <button onClick={() => duplicateProp(selected.id)} style={styles.btnSmall} aria-label="Duplicate prop">
                Duplicate
              </button>
              <button onClick={() => deleteProp(selected.id)} style={{ ...styles.btnSmall, background: '#5a2020' }} aria-label="Delete prop">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Inline styles (internal tool, no CSS modules needed) ────────────── */

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 240,
    minWidth: 200,
    background: '#16213e',
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    padding: 8,
    overflowY: 'auto',
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
    color: '#ddd',
  },
  canvasArea: {
    flex: 1,
    background: '#111',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    cursor: 'crosshair',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    background: '#0d1117',
    borderBottom: '1px solid #333',
  },
  input: {
    width: '100%',
    padding: '4px 6px',
    marginBottom: 6,
    background: '#0d1117',
    border: '1px solid #333',
    borderRadius: 3,
    color: '#eee',
    fontSize: 12,
  },
  numInput: {
    width: 64,
    padding: '2px 4px',
    background: '#0d1117',
    border: '1px solid #444',
    borderRadius: 2,
    color: '#eee',
    fontSize: 12,
  },
  label: {
    fontSize: 11,
    color: '#aaa',
  },
  btnSmall: {
    padding: '3px 8px',
    fontSize: 11,
    background: '#2a3a4a',
    border: '1px solid #555',
    borderRadius: 3,
    color: '#ddd',
    cursor: 'pointer',
  },
  assetList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  assetItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 4px',
    cursor: 'pointer',
    borderRadius: 3,
    border: '1px solid transparent',
  },
  layerList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  layerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 6px',
    cursor: 'grab',
    borderRadius: 2,
    fontSize: 12,
  },
  propGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '3px 6px',
    alignItems: 'center',
  },
}
