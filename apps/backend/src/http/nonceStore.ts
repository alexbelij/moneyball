import crypto from 'node:crypto'

export type NonceRecord = {
  suiAddress: string
  nonce: string
  issuedAt: string
  expiresAt: string
  message: string
  used: boolean
}

export class NonceStore {
  private byNonce = new Map<string, NonceRecord>()

  constructor(private ttlMs: number) {}

  issue(input: { suiAddress: string; message: string }) {
    const nonce = crypto.randomUUID()
    const issuedAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + this.ttlMs).toISOString()

    const rec: NonceRecord = {
      suiAddress: input.suiAddress.toLowerCase(),
      nonce,
      issuedAt,
      expiresAt,
      message: input.message,
      used: false,
    }

    this.byNonce.set(nonce, rec)
    return { nonce, issuedAt, expiresAt, message: input.message }
  }

  consumeOrThrow(input: { suiAddress: string; nonce: string; message: string }) {
    const rec = this.byNonce.get(input.nonce)
    if (!rec) throw new Error('INVALID_NONCE')
    if (rec.used) throw new Error('NONCE_REPLAY')
    if (Date.now() > Date.parse(rec.expiresAt)) throw new Error('NONCE_EXPIRED')
    if (rec.suiAddress !== input.suiAddress.toLowerCase()) throw new Error('NONCE_ADDRESS_MISMATCH')
    if (rec.message !== input.message) throw new Error('MESSAGE_MISMATCH')
    rec.used = true
    return rec
  }
}
