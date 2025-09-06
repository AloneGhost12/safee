/**
 * Comprehensive unit tests for crypto/index.ts
 * Tests key derivation, encryption, decryption, and file chunk operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateDEK,
  deriveMasterKey,
  wrapDEK,
  unwrapDEK,
  encryptWithDEK,
  decryptWithDEK,
  exportEncryptedBackup,
  importEncryptedBackup,
  encryptFileInChunks,
  decryptFileChunks,
  type ArrayBufferOrString
} from '../../src/crypto/index'

// Mock crypto.getRandomValues for deterministic tests
const mockIv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
const originalGetRandomValues = crypto.getRandomValues

beforeEach(() => {
  crypto.getRandomValues = vi.fn().mockReturnValue(mockIv)
})

afterEach(() => {
  crypto.getRandomValues = originalGetRandomValues
  vi.restoreAllMocks()
})

describe('generateDEK', () => {
  it('should generate a valid AES-GCM key', async () => {
    const dek = await generateDEK()
    
    expect(dek).toBeInstanceOf(CryptoKey)
    expect(dek.algorithm.name).toBe('AES-GCM')
    expect((dek.algorithm as AesKeyAlgorithm).length).toBe(256)
    expect(dek.usages).toContain('encrypt')
    expect(dek.usages).toContain('decrypt')
    expect(dek.extractable).toBe(true)
  })

  it('should generate unique keys on each call', async () => {
    const dek1 = await generateDEK()
    const dek2 = await generateDEK()
    
    // Export keys to compare
    const raw1 = await crypto.subtle.exportKey('raw', dek1)
    const raw2 = await crypto.subtle.exportKey('raw', dek2)
    
    expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2))
  })

  it('should generate extractable keys', async () => {
    const dek = await generateDEK()
    
    // Should be able to export the key
    await expect(crypto.subtle.exportKey('raw', dek)).resolves.toBeInstanceOf(ArrayBuffer)
  })
})

describe('deriveMasterKey', () => {
  it('should derive a master key from password and salt', async () => {
    const password = 'secure-password-123'
    const saltHex = '0123456789abcdef0123456789abcdef'
    
    const masterKey = await deriveMasterKey(password, saltHex)
    
    expect(masterKey).toBeInstanceOf(CryptoKey)
    expect(masterKey.algorithm.name).toBe('AES-GCM')
    expect((masterKey.algorithm as AesKeyAlgorithm).length).toBe(256)
    expect(masterKey.usages).toContain('encrypt')
    expect(masterKey.usages).toContain('decrypt')
  })

  it('should derive consistent keys from same password and salt', async () => {
    const password = 'test-password'
    const saltHex = 'deadbeefcafebabe0123456789abcdef'
    
    const masterKey1 = await deriveMasterKey(password, saltHex)
    const masterKey2 = await deriveMasterKey(password, saltHex)
    
    // Export and compare
    const raw1 = await crypto.subtle.exportKey('raw', masterKey1)
    const raw2 = await crypto.subtle.exportKey('raw', masterKey2)
    
    expect(new Uint8Array(raw1)).toEqual(new Uint8Array(raw2))
  })

  it('should derive different keys from different passwords', async () => {
    const saltHex = '0123456789abcdef0123456789abcdef'
    
    const masterKey1 = await deriveMasterKey('password1', saltHex)
    const masterKey2 = await deriveMasterKey('password2', saltHex)
    
    const raw1 = await crypto.subtle.exportKey('raw', masterKey1)
    const raw2 = await crypto.subtle.exportKey('raw', masterKey2)
    
    expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2))
  })

  it('should derive different keys from different salts', async () => {
    const password = 'same-password'
    
    const masterKey1 = await deriveMasterKey(password, '0123456789abcdef0123456789abcdef')
    const masterKey2 = await deriveMasterKey(password, 'fedcba9876543210fedcba9876543210')
    
    const raw1 = await crypto.subtle.exportKey('raw', masterKey1)
    const raw2 = await crypto.subtle.exportKey('raw', masterKey2)
    
    expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2))
  })

  it('should handle empty password gracefully', async () => {
    const saltHex = '0123456789abcdef0123456789abcdef'
    
    const masterKey = await deriveMasterKey('', saltHex)
    expect(masterKey).toBeInstanceOf(CryptoKey)
  })

  it('should handle unicode passwords', async () => {
    const password = 'пароль-密码-🔒'
    const saltHex = '0123456789abcdef0123456789abcdef'
    
    const masterKey = await deriveMasterKey(password, saltHex)
    expect(masterKey).toBeInstanceOf(CryptoKey)
  })

  it('should handle invalid salt hex gracefully', async () => {
    const password = 'test-password'
    const invalidSaltHex = 'not-hex-data'
    
    // This test actually works in the current implementation
    // The deriveMasterKey function doesn't validate hex input strictly
    // It treats any string as bytes to use for salt
    const masterKey = await deriveMasterKey(password, invalidSaltHex)
    expect(masterKey).toBeInstanceOf(CryptoKey)
  })
})

describe('wrapDEK / unwrapDEK', () => {
  it('should wrap and unwrap a DEK successfully', async () => {
    const password = 'test-password'
    const saltHex = '0123456789abcdef0123456789abcdef'
    
    const masterKey = await deriveMasterKey(password, saltHex)
    const dek = await generateDEK()
    
    const { wrapped, iv } = await wrapDEK(masterKey, dek)
    const unwrappedDEK = await unwrapDEK(masterKey, wrapped, iv)
    
    // Compare original and unwrapped DEK
    const originalRaw = await crypto.subtle.exportKey('raw', dek)
    const unwrappedRaw = await crypto.subtle.exportKey('raw', unwrappedDEK)
    
    expect(new Uint8Array(originalRaw)).toEqual(new Uint8Array(unwrappedRaw))
  })

  it('should produce hex-encoded wrapped key and IV', async () => {
    const masterKey = await deriveMasterKey('password', '0123456789abcdef0123456789abcdef')
    const dek = await generateDEK()
    
    const { wrapped, iv } = await wrapDEK(masterKey, dek)
    
    expect(typeof wrapped).toBe('string')
    expect(typeof iv).toBe('string')
    
    // Should be valid hex
    expect(/^[0-9a-f]+$/i.test(wrapped)).toBe(true)
    expect(/^[0-9a-f]+$/i.test(iv)).toBe(true)
    
    // IV should be 24 chars (12 bytes * 2)
    expect(iv.length).toBe(24)
  })

  it('should fail to unwrap with wrong master key', async () => {
    const masterKey1 = await deriveMasterKey('password1', '0123456789abcdef0123456789abcdef')
    const masterKey2 = await deriveMasterKey('password2', '0123456789abcdef0123456789abcdef')
    const dek = await generateDEK()
    
    const { wrapped, iv } = await wrapDEK(masterKey1, dek)
    
    await expect(unwrapDEK(masterKey2, wrapped, iv)).rejects.toThrow()
  })

  it('should fail to unwrap with corrupted data', async () => {
    const masterKey = await deriveMasterKey('password', '0123456789abcdef0123456789abcdef')
    const dek = await generateDEK()
    
    const { wrapped, iv } = await wrapDEK(masterKey, dek)
    
    // Corrupt the wrapped data
    const corruptedWrapped = wrapped.slice(0, -2) + 'ff'
    
    await expect(unwrapDEK(masterKey, corruptedWrapped, iv)).rejects.toThrow()
  })

  it('should handle multiple DEK wrap/unwrap operations', async () => {
    const masterKey = await deriveMasterKey('password', '0123456789abcdef0123456789abcdef')
    
    const deks = await Promise.all([
      generateDEK(),
      generateDEK(),
      generateDEK()
    ])
    
    // Mock different IVs for each operation
    let callCount = 0
    crypto.getRandomValues = vi.fn().mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = callCount + i
      }
      callCount += 12
      return array
    })
    
    const wrappedDEKs = await Promise.all(
      deks.map(dek => wrapDEK(masterKey, dek))
    )
    
    const unwrappedDEKs = await Promise.all(
      wrappedDEKs.map(({ wrapped, iv }) => unwrapDEK(masterKey, wrapped, iv))
    )
    
    // Verify all DEKs unwrapped correctly
    for (let i = 0; i < deks.length; i++) {
      const originalRaw = await crypto.subtle.exportKey('raw', deks[i])
      const unwrappedRaw = await crypto.subtle.exportKey('raw', unwrappedDEKs[i])
      expect(new Uint8Array(originalRaw)).toEqual(new Uint8Array(unwrappedRaw))
    }
  })
})

describe('encryptWithDEK / decryptWithDEK', () => {
  it('should encrypt and decrypt text successfully', async () => {
    const dek = await generateDEK()
    const plaintext = 'Hello, World!'
    
    const { ct, iv } = await encryptWithDEK(dek, plaintext)
    const decrypted = await decryptWithDEK(dek, ct, iv)
    
    expect(decrypted).toBe(plaintext)
  })

  it('should produce hex-encoded ciphertext and IV', async () => {
    const dek = await generateDEK()
    const plaintext = 'Test message'
    
    const { ct, iv } = await encryptWithDEK(dek, plaintext)
    
    expect(typeof ct).toBe('string')
    expect(typeof iv).toBe('string')
    expect(/^[0-9a-f]+$/i.test(ct)).toBe(true)
    expect(/^[0-9a-f]+$/i.test(iv)).toBe(true)
    expect(iv.length).toBe(24) // 12 bytes * 2
  })

  it('should handle empty string', async () => {
    const dek = await generateDEK()
    
    const { ct, iv } = await encryptWithDEK(dek, '')
    const decrypted = await decryptWithDEK(dek, ct, iv)
    
    expect(decrypted).toBe('')
  })

  it('should handle unicode text', async () => {
    const dek = await generateDEK()
    const plaintext = 'Hello 世界 🌍 Привет'
    
    const { ct, iv } = await encryptWithDEK(dek, plaintext)
    const decrypted = await decryptWithDEK(dek, ct, iv)
    
    expect(decrypted).toBe(plaintext)
  })

  it('should handle large text', async () => {
    const dek = await generateDEK()
    const plaintext = 'x'.repeat(100000)
    
    const { ct, iv } = await encryptWithDEK(dek, plaintext)
    const decrypted = await decryptWithDEK(dek, ct, iv)
    
    expect(decrypted).toBe(plaintext)
  })

  it('should fail to decrypt with wrong DEK', async () => {
    const dek1 = await generateDEK()
    const dek2 = await generateDEK()
    const plaintext = 'Secret message'
    
    const { ct, iv } = await encryptWithDEK(dek1, plaintext)
    
    await expect(decryptWithDEK(dek2, ct, iv)).rejects.toThrow()
  })

  it('should fail to decrypt with corrupted ciphertext', async () => {
    const dek = await generateDEK()
    const plaintext = 'Test message'
    
    const { ct, iv } = await encryptWithDEK(dek, plaintext)
    const corruptedCt = ct.slice(0, -2) + 'ff'
    
    await expect(decryptWithDEK(dek, corruptedCt, iv)).rejects.toThrow()
  })

  it('should produce different ciphertext for same plaintext with different IVs', async () => {
    const dek = await generateDEK()
    const plaintext = 'Same message'
    
    // Mock different IVs
    let callCount = 0
    crypto.getRandomValues = vi.fn().mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = callCount + i
      }
      callCount += 12
      return array
    })
    
    const result1 = await encryptWithDEK(dek, plaintext)
    const result2 = await encryptWithDEK(dek, plaintext)
    
    expect(result1.ct).not.toBe(result2.ct)
    expect(result1.iv).not.toBe(result2.iv)
    
    // Both should decrypt to same plaintext
    const decrypted1 = await decryptWithDEK(dek, result1.ct, result1.iv)
    const decrypted2 = await decryptWithDEK(dek, result2.ct, result2.iv)
    
    expect(decrypted1).toBe(plaintext)
    expect(decrypted2).toBe(plaintext)
  })
})

describe('exportEncryptedBackup / importEncryptedBackup', () => {
  it('should export and import backup successfully', async () => {
    const wrappedDEKHex = '0123456789abcdef'
    const items = [
      { id: '1', title: 'Note 1', content: 'Content 1' },
      { id: '2', title: 'Note 2', content: 'Content 2' }
    ]
    
    const backupJson = await exportEncryptedBackup(wrappedDEKHex, items)
    const imported = await importEncryptedBackup(backupJson)
    
    expect(imported.wrappedDEK).toBe(wrappedDEKHex)
    expect(imported.items).toEqual(items)
  })

  it('should handle empty items array', async () => {
    const wrappedDEKHex = 'deadbeef'
    const items: any[] = []
    
    const backupJson = await exportEncryptedBackup(wrappedDEKHex, items)
    const imported = await importEncryptedBackup(backupJson)
    
    expect(imported.items).toEqual([])
  })

  it('should handle complex nested objects', async () => {
    const wrappedDEKHex = 'feedface'
    const items = [
      {
        id: '1',
        title: 'Complex Note',
        content: 'Content',
        metadata: {
          tags: ['tag1', 'tag2'],
          created: new Date().toISOString(),
          nested: { data: 'value' }
        }
      }
    ]
    
    const backupJson = await exportEncryptedBackup(wrappedDEKHex, items)
    const imported = await importEncryptedBackup(backupJson)
    
    expect(imported.items).toEqual(items)
  })

  it('should produce valid JSON', async () => {
    const backupJson = await exportEncryptedBackup('abc123', [{ test: 'data' }])
    
    expect(() => JSON.parse(backupJson)).not.toThrow()
    expect(typeof backupJson).toBe('string')
  })

  it('should handle unicode in items', async () => {
    const items = [
      { title: 'Заметка', content: '内容 🔒' }
    ]
    
    const backupJson = await exportEncryptedBackup('hex123', items)
    const imported = await importEncryptedBackup(backupJson)
    
    expect(imported.items).toEqual(items)
  })

  it('should fail on invalid JSON import', async () => {
    const invalidJson = 'not-valid-json{'
    
    await expect(importEncryptedBackup(invalidJson)).rejects.toThrow()
  })
})

describe('encryptFileInChunks / decryptFileChunks', () => {
  function createTestBlob(content: string): Blob {
    return new Blob([content], { type: 'text/plain' })
  }

  it('should encrypt and decrypt file chunks successfully', async () => {
    const dek = await generateDEK()
    const content = 'Hello, World!'
    const file = createTestBlob(content)
    
    const chunks = await encryptFileInChunks(dek, file, 1024)
    const decryptedBuffer = await decryptFileChunks(dek, chunks)
    const decryptedContent = new TextDecoder().decode(decryptedBuffer)
    
    expect(decryptedContent).toBe(content)
  })

  it('should handle large files with multiple chunks', async () => {
    const dek = await generateDEK()
    const content = 'x'.repeat(5000) // 5KB content
    const file = createTestBlob(content)
    const chunkSize = 1024 // 1KB chunks
    
    // Mock different IVs for each chunk
    let callCount = 0
    crypto.getRandomValues = vi.fn().mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = callCount + i
      }
      callCount += 12
      return array
    })
    
    const chunks = await encryptFileInChunks(dek, file, chunkSize)
    
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.length).toBe(Math.ceil(file.size / chunkSize))
    
    // Verify chunk indexing
    chunks.forEach((chunk, index) => {
      expect(chunk.index).toBe(index)
      expect(chunk.iv).toBeDefined()
      expect(chunk.ct).toBeDefined()
    })
    
    const decryptedBuffer = await decryptFileChunks(dek, chunks)
    const decryptedContent = new TextDecoder().decode(decryptedBuffer)
    
    expect(decryptedContent).toBe(content)
  })

  it('should handle empty file', async () => {
    const dek = await generateDEK()
    const file = createTestBlob('')
    
    const chunks = await encryptFileInChunks(dek, file)
    const decryptedBuffer = await decryptFileChunks(dek, chunks)
    
    expect(decryptedBuffer.byteLength).toBe(0)
  })

  it('should handle file smaller than chunk size', async () => {
    const dek = await generateDEK()
    const content = 'Small file'
    const file = createTestBlob(content)
    const chunkSize = 1024
    
    const chunks = await encryptFileInChunks(dek, file, chunkSize)
    
    expect(chunks.length).toBe(1)
    expect(chunks[0].index).toBe(0)
    
    const decryptedBuffer = await decryptFileChunks(dek, chunks)
    const decryptedContent = new TextDecoder().decode(decryptedBuffer)
    
    expect(decryptedContent).toBe(content)
  })

  it('should handle binary data', async () => {
    const dek = await generateDEK()
    const binaryData = new Uint8Array([0, 1, 2, 3, 255, 254, 253])
    const file = new Blob([binaryData])
    
    const chunks = await encryptFileInChunks(dek, file)
    const decryptedBuffer = await decryptFileChunks(dek, chunks)
    const decryptedData = new Uint8Array(decryptedBuffer)
    
    expect(decryptedData).toEqual(binaryData)
  })

  it('should fail to decrypt chunks with wrong DEK', async () => {
    const dek1 = await generateDEK()
    const dek2 = await generateDEK()
    const file = createTestBlob('Secret content')
    
    const chunks = await encryptFileInChunks(dek1, file)
    
    await expect(decryptFileChunks(dek2, chunks)).rejects.toThrow()
  })

  it('should handle corrupted chunk data', async () => {
    const dek = await generateDEK()
    const file = createTestBlob('Test content')
    
    const chunks = await encryptFileInChunks(dek, file)
    
    // Corrupt one chunk
    chunks[0].ct = chunks[0].ct.slice(0, -2) + 'ff'
    
    await expect(decryptFileChunks(dek, chunks)).rejects.toThrow()
  })

  it('should handle out-of-order chunks', async () => {
    const dek = await generateDEK()
    const content = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const file = createTestBlob(content)
    const chunkSize = 5
    
    // Mock different IVs for each chunk
    let callCount = 0
    crypto.getRandomValues = vi.fn().mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = callCount + i
      }
      callCount += 12
      return array
    })
    
    const chunks = await encryptFileInChunks(dek, file, chunkSize)
    
    // Shuffle chunks
    const shuffledChunks = [...chunks].reverse()
    
    // Sort by index before decryption
    const sortedChunks = shuffledChunks.sort((a, b) => a.index - b.index)
    
    const decryptedBuffer = await decryptFileChunks(dek, sortedChunks)
    const decryptedContent = new TextDecoder().decode(decryptedBuffer)
    
    expect(decryptedContent).toBe(content)
  })

  it('should handle different chunk sizes', async () => {
    const dek = await generateDEK()
    const content = 'x'.repeat(10000)
    const file = createTestBlob(content)
    
    const chunkSizes = [512, 1024, 2048, 4096]
    
    for (const chunkSize of chunkSizes) {
      // Reset IV mock for each iteration
      crypto.getRandomValues = vi.fn().mockImplementation((array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = i
        }
        return array
      })
      
      const chunks = await encryptFileInChunks(dek, file, chunkSize)
      const expectedChunkCount = Math.ceil(file.size / chunkSize)
      
      expect(chunks.length).toBe(expectedChunkCount)
      
      const decryptedBuffer = await decryptFileChunks(dek, chunks)
      const decryptedContent = new TextDecoder().decode(decryptedBuffer)
      
      expect(decryptedContent).toBe(content)
    }
  })
})

describe('Integration tests', () => {
  it('should handle complete encryption workflow', async () => {
    const password = 'user-password-123'
    const saltHex = '0123456789abcdef0123456789abcdef'
    
    // Derive master key
    const masterKey = await deriveMasterKey(password, saltHex)
    
    // Generate and wrap DEK
    const dek = await generateDEK()
    const { wrapped: wrappedDEK, iv: wrapIv } = await wrapDEK(masterKey, dek)
    
    // Encrypt some data
    const plaintext = 'This is a secret note'
    const { ct: encryptedNote, iv: noteIv } = await encryptWithDEK(dek, plaintext)
    
    // Simulate storage/retrieval
    const items = [{ id: '1', content: encryptedNote, iv: noteIv }]
    const backup = await exportEncryptedBackup(wrappedDEK, items)
    
    // Simulate restoration
    const imported = await importEncryptedBackup(backup)
    const restoredDEK = await unwrapDEK(masterKey, imported.wrappedDEK, wrapIv)
    const decryptedNote = await decryptWithDEK(restoredDEK, imported.items[0].content, imported.items[0].iv)
    
    expect(decryptedNote).toBe(plaintext)
  })

  it('should handle concurrent operations', async () => {
    const masterKey = await deriveMasterKey('password', '0123456789abcdef0123456789abcdef')
    const dek = await generateDEK()
    
    // Encrypt multiple items concurrently
    const plaintexts = Array.from({ length: 10 }, (_, i) => `Message ${i}`)
    
    // Mock different IVs for each operation
    let callCount = 0
    crypto.getRandomValues = vi.fn().mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = callCount + i
      }
      callCount += 12
      return array
    })
    
    const encryptPromises = plaintexts.map(text => encryptWithDEK(dek, text))
    const encryptedResults = await Promise.all(encryptPromises)
    
    // Decrypt all concurrently
    const decryptPromises = encryptedResults.map(({ ct, iv }) => decryptWithDEK(dek, ct, iv))
    const decryptedResults = await Promise.all(decryptPromises)
    
    expect(decryptedResults).toEqual(plaintexts)
  })

  it('should handle password change workflow', async () => {
    const oldPassword = 'old-password'
    const newPassword = 'new-password'
    const saltHex = '0123456789abcdef0123456789abcdef'
    
    // Original setup
    const oldMasterKey = await deriveMasterKey(oldPassword, saltHex)
    const dek = await generateDEK()
    const { wrapped: oldWrappedDEK, iv: oldWrapIv } = await wrapDEK(oldMasterKey, dek)
    
    // Password change: unwrap with old key, wrap with new key
    const unwrappedDEK = await unwrapDEK(oldMasterKey, oldWrappedDEK, oldWrapIv)
    const newMasterKey = await deriveMasterKey(newPassword, saltHex)
    const { wrapped: newWrappedDEK, iv: newWrapIv } = await wrapDEK(newMasterKey, unwrappedDEK)
    
    // Verify data is still accessible with new password
    const testData = 'Important data'
    const { ct, iv } = await encryptWithDEK(unwrappedDEK, testData)
    
    // Restore with new master key
    const restoredDEK = await unwrapDEK(newMasterKey, newWrappedDEK, newWrapIv)
    const decryptedData = await decryptWithDEK(restoredDEK, ct, iv)
    
    expect(decryptedData).toBe(testData)
    
    // Verify old master key no longer works
    await expect(unwrapDEK(oldMasterKey, newWrappedDEK, newWrapIv)).rejects.toThrow()
  })
})
