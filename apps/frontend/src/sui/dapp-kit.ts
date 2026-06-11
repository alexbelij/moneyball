/**
 * dapp-kit config | v0.3.0 | 2026-06-09
 * Purpose: Use explicit fullnode URLs and default to mainnet (production).
 */

import { createNetworkConfig } from '@mysten/dapp-kit'

const SUI_FULLNODE = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
} as const

export const { networkConfig } = createNetworkConfig({
  testnet: { url: SUI_FULLNODE.testnet },
  mainnet: { url: SUI_FULLNODE.mainnet },
})

export const DEFAULT_NETWORK = 'mainnet' as const
