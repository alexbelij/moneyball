/**
 * api | v0.4.0 | 2026-06-09
 * Purpose: Central HTTP client for backend API (adds guestId + optional JWT).
 */

import { getGuestId } from '@/lib/guest'
import { config } from '@/lib/config'
import { useAuthStore } from '@/store/authStore'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const guestId = getGuestId()
  const url = new URL(path, config.backendUrl).toString()
  const token = useAuthStore.getState().token

  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-guest-id': guestId,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

// User interactions
export async function roast(agentId: string) {
  return apiFetch<{ ok: true; text: string; meta?: any }>('/api/roast', {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  })
}

export async function disagree(agentId: string) {
  return apiFetch<{ ok: true; summary: any; meta?: any }>('/api/me/disagree', {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  })
}

export async function getMeSummary() {
  return apiFetch<{ ok: true; summary: any; meta?: any }>('/api/me/summary', { method: 'GET' })
}

// Public agent events
export async function getAgentPredictions(agentId: string) {
  return apiFetch<{ ok: true; agentId: string; items: any[] }>(`/api/public/agents/${agentId}/predictions`, {
    method: 'GET',
  })
}

export async function getAgentEvolution(agentId: string) {
  return apiFetch<{ ok: true; agentId: string; items: any[] }>(`/api/public/agents/${agentId}/evolution`, {
    method: 'GET',
  })
}

// Admin agent events (JWT-admin required)
export async function adminAgentPredict(agentId: string, input: {
  matchId: string
  pick: string
  confidence: number
  reasoning: string
}) {
  return apiFetch<{ ok: true; ev: any }>(`/api/admin/agents/${agentId}/predict`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function adminAgentEvolve(agentId: string, input: {
  summary: string
  parameterDiff?: Record<string, number>
}) {
  return apiFetch<{ ok: true; ev: any }>(`/api/admin/agents/${agentId}/evolve`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function adminDayPlusOne(agentId: string) {
  return apiFetch<{ ok: true; summary: any; meta?: any }>('/api/admin/simulate/day-plus-one', {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  })
}
