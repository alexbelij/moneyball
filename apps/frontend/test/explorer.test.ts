/**
 * explorer.test | 2026-06-21
 * Unit tests for Walrus/Sui explorer URL builders.
 */
import { describe, it, expect } from 'vitest'
import { walrusBlobUrl, suiObjectUrl, WALRUS_BLOB_EXPLORER, SUI_OBJECT_EXPLORER } from '@/lib/explorer'

describe('walrusBlobUrl', () => {
  it('builds a correct WalrusScan blob URL', () => {
    const blobId = 'abc123def456'
    expect(walrusBlobUrl(blobId)).toBe(`${WALRUS_BLOB_EXPLORER}/${blobId}`)
  })

  it('includes the full blob ID without truncation', () => {
    const blobId = '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678'
    const url = walrusBlobUrl(blobId)
    expect(url).toContain(blobId)
    expect(url).toBe(`https://walruscan.com/blob/${blobId}`)
  })
})

describe('suiObjectUrl', () => {
  it('builds a correct SuiScan object URL', () => {
    const objectId = '0xa22ada9c09100eaca2571b64a2494f00a5393b012132aa74392bdcc6bd0a3272'
    expect(suiObjectUrl(objectId)).toBe(`${SUI_OBJECT_EXPLORER}/${objectId}`)
  })

  it('uses the mainnet base URL', () => {
    const url = suiObjectUrl('0x1234')
    expect(url).toContain('suiscan.xyz/mainnet/object')
  })
})
