import { useApp } from '@/context/AppContext'
import * as crypto from '@/crypto'

// Hook for handling client-side encryption/decryption with caching
export function useCrypto() {
  const { state, dispatch } = useApp()

  const encryptNote = async (
    plainNote: { title: string; content: string; tags: string[] },
    masterKey: CryptoKey,
    dek?: CryptoKey
  ) => {
    try {
      // Generate DEK if not provided
      const dataKey = dek || await crypto.generateDEK()
      
      // Encrypt the note data
      const titleData = await crypto.encryptWithDEK(dataKey, plainNote.title)
      const contentData = await crypto.encryptWithDEK(dataKey, plainNote.content)
      const tagsData = await crypto.encryptWithDEK(dataKey, JSON.stringify(plainNote.tags))

      // Wrap the DEK with master key
      const wrappedDEK = await crypto.wrapDEK(masterKey, dataKey)

      return {
        title: `${titleData.ct}:${titleData.iv}`,
        content: `${contentData.ct}:${contentData.iv}`,
        tags: [`${tagsData.ct}:${tagsData.iv}`], // Store as single encrypted string
        wrappedDEK: `${wrappedDEK.wrapped}:${wrappedDEK.iv}`,
        isEncrypted: true,
      }
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt note')
    }
  }

  const decryptNote = async (
    encryptedNote: any,
    masterKey: CryptoKey
  ) => {
    try {
      // Check if already cached
      const cached = state.decryptedNotes.get(encryptedNote.id)
      if (cached) {
        return cached
      }

      // Unwrap DEK
      const [wrappedHex, wrappedIv] = encryptedNote.wrappedDEK.split(':')
      const dek = await crypto.unwrapDEK(masterKey, wrappedHex, wrappedIv)

      // Decrypt fields
      const [titleCt, titleIv] = encryptedNote.title.split(':')
      const [contentCt, contentIv] = encryptedNote.content.split(':')
      const [tagsCt, tagsIv] = encryptedNote.tags[0].split(':')

      const title = await crypto.decryptWithDEK(dek, titleCt, titleIv)
      const content = await crypto.decryptWithDEK(dek, contentCt, contentIv)
      const tagsJson = await crypto.decryptWithDEK(dek, tagsCt, tagsIv)
      const tags = JSON.parse(tagsJson)

      const decryptedNote = {
        ...encryptedNote,
        title,
        content,
        tags,
        isEncrypted: false,
      }

      // Cache the decrypted note
      dispatch({
        type: 'SET_DECRYPTED_NOTE',
        payload: { id: encryptedNote.id, note: decryptedNote },
      })

      return decryptedNote
    } catch (error) {
      console.error('Decryption failed:', error)
      throw new Error('Failed to decrypt note')
    }
  }

  const clearDecryptedCache = () => {
    dispatch({ type: 'CLEAR_STATE' })
  }

  const removeFromCache = (noteId: string) => {
    dispatch({ type: 'REMOVE_DECRYPTED_NOTE', payload: noteId })
  }

  const getMasterKey = async (): Promise<CryptoKey | null> => {
    // In a real app, this would derive the master key from user password
    // For demo purposes, we'll generate a consistent key based on user ID
    if (!state.user?.id) {
      return null
    }
    
    try {
      // Generate a consistent key based on user ID (in real app, use password)
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(state.user.id.padEnd(32, '0')),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      )
      
      const masterKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new TextEncoder().encode('vault-salt'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
      )
      
      return masterKey
    } catch (error) {
      console.error('Failed to derive master key:', error)
      return null
    }
  }

  return {
    encryptNote,
    decryptNote,
    clearDecryptedCache,
    removeFromCache,
    getMasterKey,
  }
}
