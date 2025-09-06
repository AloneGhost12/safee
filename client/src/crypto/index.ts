// Client-side crypto helpers using Web Crypto

// Notes:
// - Argon2id KDF must be implemented via a WASM library (e.g., argon2-browser) in production.
// - For tests we mock deriveMasterKey using subtle.importKey directly.

export type ArrayBufferOrString = ArrayBuffer | string

function str2ab(str: string) {
  return new TextEncoder().encode(str)
}

function ab2str(buf: ArrayBuffer) {
  return new TextDecoder().decode(buf)
}

export async function generateDEK() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function deriveMasterKey(password: string, saltHex: string) {
  // Placeholder: production should use Argon2id WASM to derive key material.
  // For now, we use PBKDF2 (not as strong) to derive a CryptoKey for the master key.
  const salt = hexToBytes(saltHex)
  const baseKey = await crypto.subtle.importKey('raw', str2ab(password), { name: 'PBKDF2' }, false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  return key
}

export async function wrapDEK(masterKey: CryptoKey, dek: CryptoKey) {
  // Use raw export + AES-GCM encrypt with derived key
  const raw = await crypto.subtle.exportKey('raw', dek)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, raw)
  return { wrapped: bytesToHex(new Uint8Array(cipher)), iv: bytesToHex(iv) }
}

export async function unwrapDEK(masterKey: CryptoKey, wrappedHex: string, ivHex: string) {
  const wrapped = hexToBytes(wrappedHex)
  const iv = hexToBytes(ivHex)
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, wrapped.buffer)
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

export async function encryptWithDEK(dek: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, str2ab(plaintext))
  return { ct: bytesToHex(new Uint8Array(cipher)), iv: bytesToHex(iv) }
}

export async function decryptWithDEK(dek: CryptoKey, ctHex: string, ivHex: string) {
  const ct = hexToBytes(ctHex)
  const iv = hexToBytes(ivHex)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, ct.buffer)
  return ab2str(plain)
}

export async function exportEncryptedBackup(wrappedDEKHex: string, items: any[]) {
  // Create a single JSON blob containing wrapped DEK and encrypted items
  return JSON.stringify({ wrappedDEK: wrappedDEKHex, items })
}

export async function importEncryptedBackup(backupJson: string) {
  return JSON.parse(backupJson)
}

// helpers
function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  return bytes
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Chunked file encryption: iterate over file slices and encrypt each with same DEK and unique IV
export async function encryptFileInChunks(dek: CryptoKey, file: Blob, chunkSize = 1024 * 256) {
  const chunks: { iv: string; ct: string; index: number }[] = []
  let offset = 0
  let index = 0
  while (offset < file.size) {
    const slice = file.slice(offset, offset + chunkSize)
    const arrayBuffer = await slice.arrayBuffer()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, arrayBuffer)
    chunks.push({ iv: bytesToHex(iv), ct: bytesToHex(new Uint8Array(cipher)), index })
    offset += chunkSize
    index += 1
  }
  return chunks
}

export async function decryptFileChunks(dek: CryptoKey, chunks: { iv: string; ct: string }[]) {
  const buffers: ArrayBuffer[] = []
  for (const c of chunks) {
    const ct = hexToBytes(c.ct)
    const iv = hexToBytes(c.iv)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, ct.buffer)
    buffers.push(plain)
  }
  // concatenate
  const total = buffers.reduce((sum, b) => sum + b.byteLength, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const b of buffers) {
    out.set(new Uint8Array(b), off)
    off += b.byteLength
  }
  return out.buffer
}
