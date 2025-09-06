import { describe, it, expect } from 'vitest'
import { generateDEK, encryptWithDEK, decryptWithDEK, deriveMasterKey, wrapDEK, unwrapDEK } from '../src/crypto/index'

describe('client crypto', () => {
  it('encrypt/decrypt with DEK', async () => {
    const dek = await generateDEK()
    const msg = 'hello secret'
    const enc = await encryptWithDEK(dek, msg)
    const dec = await decryptWithDEK(dek, enc.ct, enc.iv)
    expect(dec).toBe(msg)
  })

  it('wrap/unwrap dek with master key', async () => {
    const dek = await generateDEK()
    const master = await deriveMasterKey('password123', 'a1b2c3d4a1b2c3d4')
    const wrapped = await wrapDEK(master, dek)
    const un = await unwrapDEK(master, wrapped.wrapped, wrapped.iv)
    const msg = 'wrap test'
    const enc = await encryptWithDEK(un, msg)
    const dec = await decryptWithDEK(un, enc.ct, enc.iv)
    expect(dec).toBe(msg)
  })
})
