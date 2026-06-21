/**
 * explorer | v1.0.0 | 2026-06-21
 * Purpose: URL builders for Walrus and Sui on-chain explorers.
 * Single source of truth for explorer base URLs used across
 * EvolutionView, VerifyPanel, WalrusProof, and AgentJournal.
 */

/** Walrus blob explorer (WalrusScan mainnet). */
export const WALRUS_BLOB_EXPLORER = 'https://walruscan.com/blob'

/** Sui object explorer (SuiScan mainnet). */
export const SUI_OBJECT_EXPLORER = 'https://suiscan.xyz/mainnet/object'

/**
 * Build a WalrusScan URL for a specific blob.
 * @param blobId — Walrus blob content-address returned by MemWal writes.
 */
export const walrusBlobUrl = (blobId: string): string =>
  `${WALRUS_BLOB_EXPLORER}/${blobId}`

/**
 * Build a SuiScan URL for a Sui object (MemWalAccount, site object, etc.).
 * @param objectId — Sui object ID (0x-prefixed hex).
 */
export const suiObjectUrl = (objectId: string): string =>
  `${SUI_OBJECT_EXPLORER}/${objectId}`
