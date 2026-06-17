/**
 * devConsole | v1.0.0 | 2026-06-14
 * Purpose: Developer-console easter egg (T50). Prints a styled pixel banner,
 *          a "deploy your own agent" pointer (Agent Hive / T52), the football
 *          quote of the day, and a live console.table of agents currently in
 *          the world state.
 *
 * Notes:
 *  - Pure side-effect on the browser console; safe no-op without a console.
 *  - Idempotent: repeated calls print once per page load.
 *  - Colours come from tokens.ts (single source of truth), not raw literals.
 */

import { palette, accents, text } from '@/styles/tokens'
import { useGameStore } from '@/store/gameStore'
import { quoteOfTheDay } from '@/lib/footballQuotes'

let printed = false

/** Build the %c style string for the banner headline. */
function bannerStyle(): string {
  return [
    `background:${palette.wood900}`,
    `color:${accents.gold}`,
    'font-family:monospace',
    'font-size:13px',
    'font-weight:bold',
    'padding:6px 10px',
    'line-height:1.4',
  ].join(';')
}

function labelStyle(): string {
  return [`color:${accents.green}`, 'font-family:monospace', 'font-weight:bold'].join(';')
}

function dimStyle(): string {
  return [`color:${text.muted}`, 'font-family:monospace'].join(';')
}

/** ASCII pixel wordmark — no emoji (UI/output emoji-free per design rules). */
const WORDMARK = [
  '  __  __  ___  _  _ ___ _   _ ___   _   _   _    ',
  ' |  \\/  |/ _ \\| \\| | __| | | | _ ) /_\\ | | | |   ',
  ' | |\\/| | (_) | .` | _|| |_| | _ \\/ _ \\| |_| |__ ',
  ' |_|  |_|\\___/|_|\\_|___|\\___/|___/_/ \\_\\____|____|',
].join('\n')

/** Snapshot live agents from the game store into a console.table-friendly shape. */
export function liveAgentRows(): Array<Record<string, string>> {
  const agents = useGameStore.getState().agents
  return Object.values(agents).map((a) => ({
    agentId: a.agentId,
    name: a.name,
    role: a.role,
    status: a.status,
    lastThought: a.lastThought ?? '—',
  }))
}

/**
 * Print the easter egg to the console. Idempotent and console-safe.
 * Returns true if it actually printed (useful for tests).
 */
export function initDevConsole(): boolean {
  if (printed) return false
  if (typeof console === 'undefined' || typeof console.log !== 'function') return false
  printed = true

  // Banner
  console.log(`%c${WORDMARK}`, bannerStyle())
  console.log(
    '%cManager Cabinet — autonomous football-prediction agents whose memory lives on Walrus.',
    dimStyle(),
  )

  // Deploy-your-own-agent pointer (Agent Hive / T52)
  console.log(
    '%cBuild your own agent:%c the Agent Hive SDK lets you register a persona and submit predictions.\n  Docs & sample: see packages/agent-sdk in the repo (anna-stolbovskaja/moneyball).',
    labelStyle(),
    dimStyle(),
  )

  // Quote of the day
  const q = quoteOfTheDay()
  console.log(`%c"${q.text}" — ${q.author}`, dimStyle())

  // Live agents table
  const rows = liveAgentRows()
  if (rows.length > 0 && typeof console.table === 'function') {
    console.log('%cLive agents in the cabinet:', labelStyle())
    console.table(rows)
  } else {
    console.log('%cAgents will appear here once the world state streams in…', dimStyle())
  }

  return true
}

/** Test-only: reset the idempotency guard. */
export function __resetDevConsoleForTest(): void {
  printed = false
}
