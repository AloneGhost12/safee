import request from 'supertest'
import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import cookieParser from 'cookie-parser'
import authRoutes from '../src/routes/auth'
import { errorHandler } from '../src/middleware/errors'

let app: express.Express
beforeAll(() => {
  app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/auth', authRoutes)
  app.use(errorHandler)
})

describe('Auth endpoints (smoke)', () => {
  it('signup returns access and sets cookie', async () => {
    const email = `test-${Date.now()}@example.com`
    const password = 'password123'
    const res = await request(app).post('/api/auth/signup').send({ email, password })
    
    console.log('Signup response status:', res.status)
    console.log('Signup response body:', res.body)
    console.log('Signup response headers:', res.headers)
    
    expect(res.status).toBe(200)
    expect(typeof res.body.access).toBe('string')
    expect(res.headers['set-cookie']).toBeTruthy()
  })

  // Run the same test multiple times as requested
  it('signup returns access and sets cookie - run 2', async () => {
    const email = `test-${Date.now()}@example.com`
    const password = 'password123'
    const res = await request(app).post('/api/auth/signup').send({ email, password })
    expect(res.status).toBe(200)
    expect(typeof res.body.access).toBe('string')
    expect(res.headers['set-cookie']).toBeTruthy()
  })

  it('signup returns access and sets cookie - run 3', async () => {
    const email = `test-${Date.now()}@example.com`
    const password = 'password123'
    const res = await request(app).post('/api/auth/signup').send({ email, password })
    expect(res.status).toBe(200)
    expect(typeof res.body.access).toBe('string')
    expect(res.headers['set-cookie']).toBeTruthy()
  })

  it('signup returns access and sets cookie - run 4', async () => {
    const email = `test-${Date.now()}@example.com`
    const password = 'password123'
    const res = await request(app).post('/api/auth/signup').send({ email, password })
    expect(res.status).toBe(200)
    expect(typeof res.body.access).toBe('string')
    expect(res.headers['set-cookie']).toBeTruthy()
  })

  it('signup returns access and sets cookie - run 5', async () => {
    const email = `test-${Date.now()}@example.com`
    const password = 'password123'
    const res = await request(app).post('/api/auth/signup').send({ email, password })
    expect(res.status).toBe(200)
    expect(typeof res.body.access).toBe('string')
    expect(res.headers['set-cookie']).toBeTruthy()
  })
})
