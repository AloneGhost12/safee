import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthedRequest } from '../middleware/auth'
import { notesCollection } from '../models/note'
import { ObjectId } from 'mongodb'

const router = Router()
router.use(requireAuth)

// Support both old format (title, content) and new encrypted format (ciphertext, iv)
const createSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  ciphertext: z.string().optional(),
  iv: z.string().optional(),
  tags: z.array(z.string()).optional()
}).refine(data =>
  (data.title !== undefined && data.content !== undefined) ||
  (data.ciphertext !== undefined && data.iv !== undefined),
  {
    message: "Either (title and content) or (ciphertext and iv) must be provided"
  }
)

const updateSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  ciphertext: z.string().optional(),
  iv: z.string().optional(),
  tags: z.array(z.string()).optional()
})

router.post('/', async (req: AuthedRequest, res) => {
  const parsed = createSchema.parse(req.body)
  const col = notesCollection()

  // Handle both old and new formats
  const baseDoc = {
    userId: new ObjectId(req.userId),
    tags: parsed.tags || [],
    createdAt: new Date(),
    updatedAt: new Date()
  }

  let doc
  if (parsed.ciphertext && parsed.iv) {
    // New encrypted format
    doc = { ...baseDoc, ciphertext: parsed.ciphertext, iv: parsed.iv, isEncrypted: true }
  } else {
    // Old plain text format
    doc = { ...baseDoc, title: parsed.title, content: parsed.content, isEncrypted: false }
  }

  const result = await col.insertOne(doc as any)

  // Return the created note in a format the client expects
  const createdNote = {
    id: result.insertedId.toHexString(),
    title: parsed.title || 'Encrypted Note',
    content: parsed.content || 'Encrypted Content',
    tags: parsed.tags || [],
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    isEncrypted: !!parsed.ciphertext
  }

  res.json({ note: createdNote })
})

router.get('/', async (req: AuthedRequest, res) => {
  const col = notesCollection()
  const docs = await col.find({ userId: new ObjectId(req.userId), deletedAt: { $exists: false } }).toArray()

  // Transform docs to client format
  const notes = docs.map(doc => ({
    id: doc._id.toHexString(),
    title: doc.title || 'Encrypted Note',
    content: doc.content || 'Encrypted Content',
    tags: doc.tags || [],
    createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
    isDeleted: !!doc.deletedAt,
    isEncrypted: doc.isEncrypted || !!doc.ciphertext
  }))

  res.json({ notes })
})

router.get('/deleted', async (req: AuthedRequest, res) => {
  const col = notesCollection()
  const docs = await col.find({ userId: new ObjectId(req.userId), deletedAt: { $exists: true } }).toArray()

  // Transform docs to client format
  const notes = docs.map(doc => ({
    id: doc._id.toHexString(),
    title: doc.title || 'Encrypted Note',
    content: doc.content || 'Encrypted Content',
    tags: doc.tags || [],
    createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
    deletedAt: doc.deletedAt?.toISOString() || new Date().toISOString(),
    isDeleted: true,
    isEncrypted: doc.isEncrypted || !!doc.ciphertext
  }))

  res.json({ notes })
})

router.get('/:id', async (req: AuthedRequest, res) => {
  const col = notesCollection()
  const doc = await col.findOne({ _id: new ObjectId(req.params.id), userId: new ObjectId(req.userId) })
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})

router.put('/:id', async (req: AuthedRequest, res) => {
  try {
    const parsed = updateSchema.parse(req.body)
    const col = notesCollection()

    // Build update object based on format
    let setDoc: any = {
      updatedAt: new Date()
    }

    let unsetDoc: any = {}

    if (parsed.ciphertext && parsed.iv) {
      // New encrypted format
      setDoc.ciphertext = parsed.ciphertext
      setDoc.iv = parsed.iv
      setDoc.isEncrypted = true
      if (parsed.tags) setDoc.tags = parsed.tags
      // Remove old format fields
      unsetDoc.title = ''
      unsetDoc.content = ''
    } else {
      // Old plain text format
      setDoc.title = parsed.title
      setDoc.content = parsed.content
      setDoc.isEncrypted = false
      if (parsed.tags) setDoc.tags = parsed.tags
      // Remove new format fields
      unsetDoc.ciphertext = ''
      unsetDoc.iv = ''
    }

    const updateOperation: any = { $set: setDoc }
    if (Object.keys(unsetDoc).length > 0) {
      updateOperation.$unset = unsetDoc
    }

    const result = await col.updateOne(
      { _id: new ObjectId(req.params.id), userId: new ObjectId(req.userId) },
      updateOperation
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Note not found' })
    }

    // Fetch the updated note to return
    const updatedNote = await col.findOne({ _id: new ObjectId(req.params.id), userId: new ObjectId(req.userId) })

    if (!updatedNote) {
      return res.status(404).json({ error: 'Note not found after update' })
    }

    const note = {
      id: updatedNote._id.toHexString(),
      title: updatedNote.title || 'Encrypted Note',
      content: updatedNote.content || 'Encrypted Content',
      tags: updatedNote.tags || [],
      createdAt: updatedNote.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: updatedNote.updatedAt?.toISOString() || new Date().toISOString(),
      isDeleted: !!updatedNote.deletedAt,
      isEncrypted: updatedNote.isEncrypted || !!updatedNote.ciphertext
    }

    res.json({ note })
  } catch (error: any) {
    console.error('❌ Error updating note:', error)
    res.status(500).json({ error: error.message || 'Failed to update note' })
  }
})

router.delete('/:id', async (req: AuthedRequest, res) => {
  const col = notesCollection()
  await col.updateOne({ _id: new ObjectId(req.params.id), userId: new ObjectId(req.userId) }, { $set: { deletedAt: new Date() } })
  res.json({ ok: true })
})

router.post('/:id/restore', async (req: AuthedRequest, res) => {
  const col = notesCollection()
  await col.updateOne({ _id: new ObjectId(req.params.id), userId: new ObjectId(req.userId) }, { $unset: { deletedAt: '' } })
  res.json({ ok: true })
})

router.delete('/:id/permanent', async (req: AuthedRequest, res) => {
  const col = notesCollection()
  await col.deleteOne({ _id: new ObjectId(req.params.id), userId: new ObjectId(req.userId) })
  res.json({ ok: true })
})

export default router
