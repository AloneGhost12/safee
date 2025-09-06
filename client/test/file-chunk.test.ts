import { describe, it, expect } from 'vitest'
import { generateDEK, encryptFileInChunks, decryptFileChunks } from '../src/crypto/index'

describe('file chunk encryption', () => {
  it('encrypts and decrypts chunks', async () => {
    const dek = await generateDEK()
    const data = new TextEncoder().encode('a'.repeat(1024 * 512))
    const blob = new Blob([data])
    const chunks = await encryptFileInChunks(dek, blob, 1024 * 128)
    const out = await decryptFileChunks(dek, chunks as any)
    const text = new TextDecoder().decode(out)
    expect(text.length).toBe(data.length)
  })
})
