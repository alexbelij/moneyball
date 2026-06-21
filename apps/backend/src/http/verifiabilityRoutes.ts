/**
 * verifiabilityRoutes | v1.0.0 | 2026-06-18
 * Purpose: Public endpoint surfacing on-chain identifiers and provenance
 *          metadata so judges (and any user) can independently verify that
 *          agent memory actually lives on Walrus mainnet.
 *
 * T64: blob/object IDs, explorer links, per-agent MemWal namespaces,
 *      read-model counts, and the "How to verify" recipe.
 *
 * Zero secrets are returned — only public identifiers and counts.
 */

import type { Express } from 'express'
import { env } from '../config/env'
import { AgentEventService } from '../agents/agentEventService'

/** Well-known Walrus explorers for mainnet. */
const WALRUS_EXPLORERS = [
  { name: 'WalrusScan', baseUrl: 'https://walruscan.com' },
  { name: 'Suivision (Walrus)', baseUrl: 'https://walrus.suivision.xyz' },
] as const

/** Well-known Sui explorers for object lookups. */
const SUI_EXPLORERS = [
  { name: 'Suivision', baseUrl: 'https://suivision.xyz' },
  { name: 'SuiScan', baseUrl: 'https://suiscan.xyz/mainnet' },
] as const

/** Walrus site object published via site-builder (Walrus mainnet). */
const WALRUS_SITE_OBJECT =
  '0xa22ada9c09100eaca2571b64a2494f00a5393b012132aa74392bdcc6bd0a3272'

/** Agent IDs — must stay in sync with index.ts SEED_AGENTS. */
const AGENT_IDS = [
  'dr_morgan',
  'scout_alvarez',
  'viktor_kane',
  'sofia_mendes',
  'madame_pythia',
] as const

export interface AgentVerifiability {
  agentId: string
  memwalNamespace: string
  counts: {
    predictions: number
    outcomes: number
    evolutions: number
    substantiveEvolutions: number
  }
}

export interface VerifiabilityResponse {
  ok: true
  walrusSiteObject: string
  frontendUrl: string
  memwalRelayer: string
  memwalAccountId: string
  /** Ready-built explorer link to the MemWalAccount Sui object, or null if not configured. */
  memwalAccountObjectUrl: string | null
  memwalNamespacePattern: string
  agents: AgentVerifiability[]
  explorers: {
    walrus: Array<{ name: string; baseUrl: string }>
    sui: Array<{ name: string; baseUrl: string }>
  }
  howToVerify: string[]
}

export function registerVerifiabilityRoutes(
  app: Express,
  svc: AgentEventService,
) {
  app.get('/api/public/verifiability', (_req, res) => {
    const agents: AgentVerifiability[] = AGENT_IDS.map((agentId) => ({
      agentId,
      memwalNamespace: `mwc-agent:${agentId}`,
      counts: {
        predictions: svc.predictionCount(agentId),
        outcomes: svc.outcomeCount(agentId),
        evolutions: svc.evolutionCount(agentId),
        substantiveEvolutions: svc.substantiveEvolutionCount(agentId),
      },
    }))

    const memwalAccountObjectUrl = env.MEMWAL_ACCOUNT_ID
      ? `https://suiscan.xyz/mainnet/object/${env.MEMWAL_ACCOUNT_ID}`
      : null

    const response: VerifiabilityResponse = {
      ok: true,
      walrusSiteObject: WALRUS_SITE_OBJECT,
      frontendUrl: 'https://taken.wal.app',
      memwalRelayer: env.MEMWAL_RELAYER,
      memwalAccountId: env.MEMWAL_ACCOUNT_ID || '(not configured in this environment)',
      memwalAccountObjectUrl,
      memwalNamespacePattern: 'mwc-agent:{agentId}',
      agents,
      explorers: {
        walrus: WALRUS_EXPLORERS.map((e) => ({ name: e.name, baseUrl: e.baseUrl })),
        sui: SUI_EXPLORERS.map((e) => ({ name: e.name, baseUrl: e.baseUrl })),
      },
      howToVerify: [
        'Open any agent dossier -- the Evolution tab shows parameter changes with timestamps.',
        'Each memory write goes to MemWal (Walrus Memory) under namespace "mwc-agent:{agentId}".',
        'MemWal encrypts the memory, generates an embedding, and uploads the encrypted blob to Walrus mainnet.',
        'The blob_id returned by Walrus is the content-addressable identifier for that memory.',
        'Look up the Walrus site object on a Sui explorer to confirm the frontend is hosted on Walrus.',
        'Use the MemWal relayer health endpoint to verify the relayer is live and serving the correct namespace.',
        'Compare the read-model event counts (returned by /health) with what you see in the agent dossier.',
      ],
    }

    res.json(response)
  })
}
