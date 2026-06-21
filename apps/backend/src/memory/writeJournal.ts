/**
 * WriteJournal | v1.0.0 | 2026-06-21 | TASK 3
 * Purpose: Append-only on-disk journal of pending MemWal write-queue entries.
 * On process crash/restart, unfinished entries are reloaded and re-enqueued
 * so no provenance gaps remain. Entries are pruned on successful write.
 *
 * Format: one JSON object per line (JSONL). Keys: key, text, enqueuedAt.
 * A "done" line marks a key as completed: { done: key }.
 * On load, we replay the journal: entries minus done keys = pending.
 *
 * Compaction: after COMPACT_THRESHOLD lines, rewrite to only pending entries.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface JournalEntry {
  key: string
  text: string
  enqueuedAt: number
}

interface DoneLine {
  done: string
}

type JournalLine = JournalEntry | DoneLine

const COMPACT_THRESHOLD = 200

function isDone(line: JournalLine): line is DoneLine {
  return 'done' in line
}

export class WriteJournal {
  private filePath: string
  private lineCount = 0

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true })
    this.filePath = resolve(dataDir, 'write-journal.jsonl')
  }

  /**
   * Append a pending entry to the journal.
   */
  append(entry: JournalEntry): void {
    appendFileSync(this.filePath, JSON.stringify(entry) + '\n')
    this.lineCount++
  }

  /**
   * Mark a key as completed (entry was successfully sent to MemWal).
   */
  markDone(key: string): void {
    appendFileSync(this.filePath, JSON.stringify({ done: key }) + '\n')
    this.lineCount++
    if (this.lineCount >= COMPACT_THRESHOLD) {
      this.compact()
    }
  }

  /**
   * Load and replay the journal, returning only pending (not-yet-done) entries.
   */
  loadPending(): JournalEntry[] {
    if (!existsSync(this.filePath)) return []

    const raw = readFileSync(this.filePath, 'utf-8')
    const lines = raw.split('\n').filter(Boolean)
    this.lineCount = lines.length

    const pending = new Map<string, JournalEntry>()
    const doneKeys = new Set<string>()

    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as JournalLine
        if (isDone(obj)) {
          doneKeys.add(obj.done)
          pending.delete(obj.done)
        } else if (obj.key && obj.text) {
          if (!doneKeys.has(obj.key)) {
            pending.set(obj.key, obj)
          }
        }
      } catch {
        // Skip corrupt lines
      }
    }

    // Auto-compact on load if there are many done lines
    if (this.lineCount >= COMPACT_THRESHOLD) {
      this.compactWith([...pending.values()])
    }

    return [...pending.values()]
  }

  /**
   * Rewrite journal with only pending entries (removes done markers and completed entries).
   */
  private compact(): void {
    const pending = this.loadPending()
    this.compactWith(pending)
  }

  private compactWith(entries: JournalEntry[]): void {
    const data = entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '')
    writeFileSync(this.filePath, data)
    this.lineCount = entries.length
  }
}
