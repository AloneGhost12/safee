import request from 'supertest'
import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import healthRoutes from '../src/routes/health'

let app: express.Express
beforeAll(() => {
  app = express()
  app.use('/api', healthRoutes)
})

describe('GET /api/health', () => {
  it('returns 200 and status ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
