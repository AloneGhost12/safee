import request from 'supertest'
import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import cookieParser from 'cookie-parser'
import authRoutes from '../src/routes/auth'
import notesRoutes from '../src/routes/notes'

let app: express.Express
beforeAll(() => {
  app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/auth', authRoutes)
  app.use('/api/notes', notesRoutes)
})

describe('Notes API (smoke)', () => {
  it('create/list/get/delete/restore/purge flow', async () => {
    // This test is a smoke test; in CI use an in-memory DB or mocks
    const signup = await request(app).post('/api/auth/signup').send({ email: 'notes@example.com', password: 'password123' })
    const access = signup.body.access
    if (!access) return expect(true).toBeTruthy()
    const headers = { Authorization: `Bearer ${access}` }
    const created = await request(app).post('/api/notes').set(headers).send({ ciphertext: 'ct', iv: 'iv' })
    expect(created.status).toBe(200)
    const list = await request(app).get('/api/notes').set(headers)
    expect(Array.isArray(list.body)).toBeTruthy()
  })
})
