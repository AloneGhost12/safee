/**
 * Comprehensive unit tests for crypto/files.ts
 * Tests encryption, decryption, file handling, and error scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  encryptFileName,
  decryptFileName,
  encryptFile,
  decryptFile,
  validateFileForUpload,
  uploadEncryptedFile,
  downloadEncryptedFile,
  type EncryptedFileMetadata,
  type FileEncryptionProgress
} from '../../src/crypto/files'

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

// Helper to create a test crypto key
async function createTestKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// Helper to create test file
function createTestFile(name: string, content: string, type: string = 'text/plain'): File {
  const blob = new Blob([content], { type })
  return new File([blob], name, { type })
}

describe('encryptFileName', () => {
  it('should encrypt a filename successfully', async () => {
    const key = await createTestKey()
    const fileName = 'test-file.txt'
    
    const encrypted = await encryptFileName(fileName, key)
    
    expect(encrypted).toBeDefined()
    expect(typeof encrypted).toBe('string')
    expect(encrypted.length).toBeGreaterThan(0)
    
    // Should be valid base64
    expect(() => atob(encrypted)).not.toThrow()
  })

  it('should encrypt different filenames to different results', async () => {
    const key = await createTestKey()
    
    // Reset crypto.getRandomValues to return different IVs
    let callCount = 0
    crypto.getRandomValues = vi.fn().mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = callCount + i
      }
      callCount += 12
      return array
    })
    
    const encrypted1 = await encryptFileName('file1.txt', key)
    const encrypted2 = await encryptFileName('file2.txt', key)
    
    expect(encrypted1).not.toBe(encrypted2)
  })

  it('should handle special characters in filename', async () => {
    const key = await createTestKey()
    const fileName = 'файл-тест-🔒.txt'
    
    const encrypted = await encryptFileName(fileName, key)
    const decrypted = await decryptFileName(encrypted, key)
    
    expect(decrypted).toBe(fileName)
  })

  it('should handle empty filename', async () => {
    const key = await createTestKey()
    const fileName = ''
    
    const encrypted = await encryptFileName(fileName, key)
    const decrypted = await decryptFileName(encrypted, key)
    
    expect(decrypted).toBe(fileName)
  })

  it('should handle very long filename', async () => {
    const key = await createTestKey()
    const longFileName = 'a'.repeat(200) + '.txt'
    
    const encrypted = await encryptFileName(longFileName, key)
    const decrypted = await decryptFileName(encrypted, key)
    
    expect(decrypted).toBe(longFileName)
  })
})

describe('decryptFileName', () => {
  it('should decrypt a properly encrypted filename', async () => {
    const key = await createTestKey()
    const originalName = 'test-document.pdf'
    
    const encrypted = await encryptFileName(originalName, key)
    const decrypted = await decryptFileName(encrypted, key)
    
    expect(decrypted).toBe(originalName)
  })

  it('should handle invalid base64 gracefully', async () => {
    const key = await createTestKey()
    
    // Test various invalid base64 strings
    const invalidNames = [
      'not-base64!@#',
      'a',  // too short
      '   ', // whitespace
      'invalid-base64-chars!@#$%'
    ]
    
    for (const invalidName of invalidNames) {
      const result = await decryptFileName(invalidName, key)
      expect(result).toBe(invalidName) // Should return original
    }
    
    // Test empty string separately since it throws an error
    await expect(decryptFileName('', key)).rejects.toThrow('Invalid encrypted name')
  })

  it('should handle legacy unencrypted filenames', async () => {
    const key = await createTestKey()
    const legacyName = 'legacy-file.txt'
    
    const result = await decryptFileName(legacyName, key)
    expect(result).toBe(legacyName)
  })

  it('should handle corrupted encrypted data', async () => {
    const key = await createTestKey()
    
    // Create a valid-looking base64 string that will fail decryption
    const corruptedData = btoa('invalid_encrypted_data_123')
    
    const result = await decryptFileName(corruptedData, key)
    expect(result).toBe(corruptedData) // Should return original on decrypt failure
  })

  it('should handle empty or null input', async () => {
    const key = await createTestKey()
    
    await expect(decryptFileName('', key)).rejects.toThrow('Invalid encrypted name: empty or not a string')
    await expect(decryptFileName(null as any, key)).rejects.toThrow('Invalid encrypted name: empty or not a string')
    await expect(decryptFileName(undefined as any, key)).rejects.toThrow('Invalid encrypted name: empty or not a string')
  })

  it('should handle base64 with whitespace', async () => {
    const key = await createTestKey()
    const originalName = 'test-file.txt'
    
    const encrypted = await encryptFileName(originalName, key)
    const withWhitespace = ' ' + encrypted + ' '
    
    const decrypted = await decryptFileName(withWhitespace, key)
    expect(decrypted).toBe(originalName)
  })

  it('should handle data too short for IV', async () => {
    const key = await createTestKey()
    
    // Create base64 that decodes to less than 12 bytes (IV size)
    const shortData = btoa('short')
    
    const result = await decryptFileName(shortData, key)
    expect(result).toBe(shortData) // Should return original
  })
})

describe('validateFileForUpload', () => {
  it('should accept valid files', () => {
    const validFile = createTestFile('document.pdf', 'test content', 'application/pdf')
    
    expect(() => validateFileForUpload(validFile)).not.toThrow()
  })

  it('should reject files that are too large', () => {
    const largeFile = createTestFile('large.pdf', 'x'.repeat(101 * 1024 * 1024), 'application/pdf')
    
    expect(() => validateFileForUpload(largeFile)).toThrow('File size exceeds maximum')
  })

  it('should reject files with disallowed types', () => {
    const invalidFile = createTestFile('malware.exe', 'dangerous content', 'application/x-executable')
    
    expect(() => validateFileForUpload(invalidFile)).toThrow('File type application/x-executable is not allowed')
  })

  it('should reject files with very long names', () => {
    const longName = 'a'.repeat(256) + '.txt'
    const longNameFile = createTestFile(longName, 'content', 'text/plain')
    
    expect(() => validateFileForUpload(longNameFile)).toThrow('Filename is too long')
  })

  it('should accept all allowed file types', () => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/x-zip-compressed'
    ]
    
    allowedTypes.forEach(type => {
      const file = createTestFile(`test.file`, 'content', type)
      expect(() => validateFileForUpload(file)).not.toThrow()
    })
  })
})

describe('encryptFile', () => {
  it('should encrypt a small file successfully', async () => {
    const key = await createTestKey()
    const file = createTestFile('test.txt', 'Hello, World!', 'text/plain')
    
    const result = await encryptFile(file, key)
    
    expect(result.encryptedBlob).toBeInstanceOf(Blob)
    expect(result.metadata).toBeDefined()
    expect(result.metadata.originalSize).toBe(file.size)
    expect(result.metadata.encryptedSize).toBeGreaterThan(file.size) // Includes IV + auth tags
    expect(result.metadata.encryptedName).toBeDefined()
    expect(result.metadata.encryptedMimeType).toBeDefined()
    expect(result.metadata.iv).toBeDefined()
    expect(result.metadata.chunkSize).toBe(64 * 1024)
  })

  it('should call progress callback during encryption', async () => {
    const key = await createTestKey()
    const file = createTestFile('test.txt', 'x'.repeat(100000), 'text/plain')
    const progressSpy = vi.fn()
    
    await encryptFile(file, key, progressSpy)
    
    expect(progressSpy).toHaveBeenCalled()
    const lastCall = progressSpy.mock.calls[progressSpy.mock.calls.length - 1][0]
    expect(lastCall.percentage).toBe(100)
    expect(lastCall.loaded).toBe(lastCall.total)
  })

  it('should handle empty file', async () => {
    const key = await createTestKey()
    const file = createTestFile('empty.txt', '', 'text/plain')
    
    const result = await encryptFile(file, key)
    
    expect(result.metadata.originalSize).toBe(0)
    expect(result.encryptedBlob.size).toBeGreaterThan(0) // Still has IV
  })

  it('should encrypt large file in chunks', async () => {
    const key = await createTestKey()
    // Create file larger than chunk size (64KB)
    const largeContent = 'x'.repeat(100 * 1024) // 100KB
    const file = createTestFile('large.txt', largeContent, 'text/plain')
    
    const result = await encryptFile(file, key)
    
    expect(result.metadata.originalSize).toBe(file.size)
    expect(result.encryptedBlob.size).toBeGreaterThan(file.size)
  })
})

describe('decryptFile', () => {
  it('should decrypt an encrypted file successfully', async () => {
    const key = await createTestKey()
    const originalContent = 'Hello, World!'
    const file = createTestFile('test.txt', originalContent, 'text/plain')
    
    const { encryptedBlob, metadata } = await encryptFile(file, key)
    const { file: decryptedFile, fileName, mimeType } = await decryptFile(encryptedBlob, metadata, key)
    
    const decryptedContent = await decryptedFile.text()
    expect(decryptedContent).toBe(originalContent)
    expect(fileName).toBe('test.txt')
    expect(mimeType).toBe('text/plain')
  })

  it('should handle file with special characters', async () => {
    const key = await createTestKey()
    const originalContent = 'Привет мир! 🌍'
    const file = createTestFile('тест-файл.txt', originalContent, 'text/plain')
    
    const { encryptedBlob, metadata } = await encryptFile(file, key)
    const { file: decryptedFile, fileName, mimeType } = await decryptFile(encryptedBlob, metadata, key)
    
    const decryptedContent = await decryptedFile.text()
    expect(decryptedContent).toBe(originalContent)
    expect(fileName).toBe('тест-файл.txt')
  })

  it('should call progress callback during decryption', async () => {
    const key = await createTestKey()
    const file = createTestFile('test.txt', 'x'.repeat(100000), 'text/plain')
    
    const { encryptedBlob, metadata } = await encryptFile(file, key)
    const progressSpy = vi.fn()
    
    await decryptFile(encryptedBlob, metadata, key, progressSpy)
    
    expect(progressSpy).toHaveBeenCalled()
    const lastCall = progressSpy.mock.calls[progressSpy.mock.calls.length - 1][0]
    expect(lastCall.percentage).toBe(100)
  })

  it('should handle empty file decryption', async () => {
    const key = await createTestKey()
    const file = createTestFile('empty.txt', '', 'text/plain')
    
    const { encryptedBlob, metadata } = await encryptFile(file, key)
    const { file: decryptedFile, fileName } = await decryptFile(encryptedBlob, metadata, key)
    
    const decryptedContent = await decryptedFile.text()
    expect(decryptedContent).toBe('')
    expect(fileName).toBe('empty.txt')
    expect(decryptedFile.size).toBe(0)
  })

  it('should fail with wrong key', async () => {
    const key1 = await createTestKey()
    const key2 = await createTestKey()
    const file = createTestFile('test.txt', 'Hello', 'text/plain')
    
    const { encryptedBlob, metadata } = await encryptFile(file, key1)
    
    await expect(decryptFile(encryptedBlob, metadata, key2)).rejects.toThrow()
  })
})

describe('uploadEncryptedFile', () => {
  it('should upload file successfully', async () => {
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn(),
      status: 200
    }
    
    // Mock XMLHttpRequest
    global.XMLHttpRequest = vi.fn(() => mockXHR) as any
    
    const blob = new Blob(['test data'])
    const uploadUrl = 'https://example.com/upload'
    
    // Simulate successful upload
    setTimeout(() => {
      const loadHandler = mockXHR.addEventListener.mock.calls.find(call => call[0] === 'load')[1]
      loadHandler()
    }, 0)
    
    await expect(uploadEncryptedFile(uploadUrl, blob, 'application/octet-stream')).resolves.not.toThrow()
    
    expect(mockXHR.open).toHaveBeenCalledWith('PUT', uploadUrl)
    expect(mockXHR.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream')
    expect(mockXHR.send).toHaveBeenCalledWith(blob)
  })

  it('should handle upload progress', async () => {
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn(),
      status: 200
    }
    
    global.XMLHttpRequest = vi.fn(() => mockXHR) as any
    
    const progressSpy = vi.fn()
    const blob = new Blob(['test data'])
    
    // Simulate progress and success
    setTimeout(() => {
      const progressHandler = mockXHR.upload.addEventListener.mock.calls.find(call => call[0] === 'progress')[1]
      progressHandler({ lengthComputable: true, loaded: 50, total: 100 })
      
      const loadHandler = mockXHR.addEventListener.mock.calls.find(call => call[0] === 'load')[1]
      loadHandler()
    }, 0)
    
    await uploadEncryptedFile('https://example.com/upload', blob, 'application/octet-stream', progressSpy)
    
    expect(progressSpy).toHaveBeenCalledWith({
      loaded: 50,
      total: 100,
      percentage: 50
    })
  })

  it('should handle upload error', async () => {
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn(),
      status: 500
    }
    
    global.XMLHttpRequest = vi.fn(() => mockXHR) as any
    
    const blob = new Blob(['test data'])
    
    // Simulate error
    setTimeout(() => {
      const loadHandler = mockXHR.addEventListener.mock.calls.find(call => call[0] === 'load')[1]
      loadHandler()
    }, 0)
    
    await expect(uploadEncryptedFile('https://example.com/upload', blob, 'application/octet-stream'))
      .rejects.toThrow('Upload failed with status 500')
  })

  it('should handle network error', async () => {
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn()
    }
    
    global.XMLHttpRequest = vi.fn(() => mockXHR) as any
    
    const blob = new Blob(['test data'])
    
    // Simulate network error
    setTimeout(() => {
      const errorHandler = mockXHR.addEventListener.mock.calls.find(call => call[0] === 'error')[1]
      errorHandler()
    }, 0)
    
    await expect(uploadEncryptedFile('https://example.com/upload', blob, 'application/octet-stream'))
      .rejects.toThrow('Upload failed')
  })
})

describe('downloadEncryptedFile', () => {
  it('should download file successfully', async () => {
    const mockResponse = new Blob(['encrypted data'])
    
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      addEventListener: vi.fn(),
      status: 200,
      response: mockResponse,
      responseType: 'blob'
    }
    
    global.XMLHttpRequest = vi.fn(() => mockXHR) as any
    
    // Simulate successful download
    setTimeout(() => {
      const loadHandler = mockXHR.addEventListener.mock.calls.find(call => call[0] === 'load')[1]
      loadHandler()
    }, 0)
    
    const result = await downloadEncryptedFile('https://example.com/download')
    
    expect(result).toBe(mockResponse)
    expect(mockXHR.open).toHaveBeenCalledWith('GET', 'https://example.com/download')
  })

  it('should handle download progress', async () => {
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      addEventListener: vi.fn(),
      status: 200,
      response: new Blob(['data']),
      responseType: 'blob'
    }
    
    global.XMLHttpRequest = vi.fn(() => mockXHR) as any
    
    const progressSpy = vi.fn()
    
    // Simulate progress and success
    setTimeout(() => {
      const progressHandler = mockXHR.addEventListener.mock.calls.find(call => call[0] === 'progress')[1]
      progressHandler({ lengthComputable: true, loaded: 75, total: 100 })
      
      const loadHandler = mockXHR.addEventListener.mock.calls.find(call => call[0] === 'load')[1]
      loadHandler()
    }, 0)
    
    await downloadEncryptedFile('https://example.com/download', progressSpy)
    
    expect(progressSpy).toHaveBeenCalledWith({
      loaded: 75,
      total: 100,
      percentage: 75
    })
  })

  it('should handle download error', async () => {
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      addEventListener: vi.fn(),
      status: 404,
      responseType: 'blob'
    }
    
    global.XMLHttpRequest = vi.fn(() => mockXHR) as any
    
    // Simulate error
    setTimeout(() => {
      const loadHandler = mockXHR.addEventListener.mock.calls.find(call => call[0] === 'load')[1]
      loadHandler()
    }, 0)
    
    await expect(downloadEncryptedFile('https://example.com/download'))
      .rejects.toThrow('Download failed with status 404')
  })
})

describe('File encryption/decryption integration', () => {
  it('should handle round-trip encryption/decryption of various file types', async () => {
    const key = await createTestKey()
    
    const testFiles = [
      { name: 'text.txt', content: 'Hello, World!', type: 'text/plain' },
      { name: 'json.json', content: '{"key": "value"}', type: 'application/json' },
      { name: 'empty.txt', content: '', type: 'text/plain' },
      { name: 'unicode.txt', content: '🌍 Hello 世界', type: 'text/plain' },
      { name: 'large.txt', content: 'x'.repeat(100000), type: 'text/plain' }
    ]
    
    for (const testFile of testFiles) {
      const file = createTestFile(testFile.name, testFile.content, testFile.type)
      
      const { encryptedBlob, metadata } = await encryptFile(file, key)
      const { file: decryptedFile, fileName, mimeType } = await decryptFile(encryptedBlob, metadata, key)
      
      const decryptedContent = await decryptedFile.text()
      
      expect(decryptedContent).toBe(testFile.content)
      expect(fileName).toBe(testFile.name)
      expect(mimeType).toBe(testFile.type)
    }
  })

  it('should produce consistent results with same input', async () => {
    const key = await createTestKey()
    const file = createTestFile('test.txt', 'Consistent content', 'text/plain')
    
    // Reset mock to produce same IV
    crypto.getRandomValues = vi.fn().mockReturnValue(mockIv)
    
    const result1 = await encryptFile(file, key)
    
    crypto.getRandomValues = vi.fn().mockReturnValue(mockIv)
    
    const result2 = await encryptFile(file, key)
    
    // With same IV, encrypted results should be identical
    expect(result1.metadata.encryptedName).toBe(result2.metadata.encryptedName)
    expect(result1.metadata.iv).toBe(result2.metadata.iv)
  })

  it('should handle concurrent encryption/decryption operations', async () => {
    const key = await createTestKey()
    
    // Create multiple files
    const files = Array.from({ length: 5 }, (_, i) => 
      createTestFile(`file${i}.txt`, `Content ${i}`, 'text/plain')
    )
    
    // Encrypt all files concurrently
    const encryptionPromises = files.map(file => encryptFile(file, key))
    const encryptedResults = await Promise.all(encryptionPromises)
    
    // Decrypt all files concurrently
    const decryptionPromises = encryptedResults.map(result => 
      decryptFile(result.encryptedBlob, result.metadata, key)
    )
    const decryptedResults = await Promise.all(decryptionPromises)
    
    // Verify all results
    decryptedResults.forEach((result, i) => {
      expect(result.fileName).toBe(`file${i}.txt`)
    })
  })
})
