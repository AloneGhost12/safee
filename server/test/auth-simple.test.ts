import request from 'supertest'
import { describe, it, expect, beforeAll, vi } from 'vitest'
import express from 'express'
import cookieParser from 'cookie-parser'

// Simple auth route for testing
const simpleAuthRoutes = express.Router()

simpleAuthRoutes.post('/signup', (req, res) => {
  const { email, password } = req.body
  
  // Simple validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }
  
  // Mock successful signup
  const access = 'mock-jwt-token-' + Date.now()
  const refresh = 'mock-refresh-token-' + Date.now()
  
  res.cookie('pv_sess', refresh, { httpOnly: true })
  res.json({ access })
})

let app: express.Express
beforeAll(() => {
  app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/auth', simpleAuthRoutes)
})

describe('Simple Auth Test', () => {
  it('Test 1: signup returns access and sets cookie', async () => {
    const email = `test-${Date.now()}@example.com`
    const password = 'password123'
    const res = await request(app).post('/api/auth/signup').send({ email, password })
    
    console.log('Test 1 - Status:', res.status)
    console.log('Test 1 - Body:', res.body)
    
    expect(res.status).toBe(200)
    expect(typeof res.body.access).toBe('string')
    expect(res.headers['set-cookie']).toBeTruthy()
  })

  it('Test 2: signup returns access and sets cookie', async () => {
    const email = `test-${Date.now()}@example.com`
    const password = 'password123'
    const res = await request(app).post('/api/auth/signup').send({ email, password })
    
    console.log('Test 2 - Status:', res.status)
    
    expect(res.status).toBe(200)
    expect(typeof res.body.access).toBe('string')
    expect(res.headers['set-cookie']).toBeTruthy()
  })

  it('Test 3: signup returns access and sets cookie', async () => {
    const email = `test-${Date.now()}@example.com`
    const password = 'password123'
    const res = await request(app).post('/api/auth/signup').send({ email, password })
    
    console.log('Test 3 - Status:', res.status)
    
    expect(res.status).toBe(200)
    expect(typeof res.body.access).toBe('string')
    expect(res.headers['set-cookie']).toBeTruthy()
  })

  it('Test 4: signup returns access and sets cookie', async () => {
    const email = `test-${Date.now()}@example.com`
    const password = 'password123'
    const res = await request(app).post('/api/auth/signup').send({ email, password })
    
    console.log('Test 4 - Status:', res.status)
    
    expect(res.status).toBe(200)
    expect(typeof res.body.access).toBe('string')
    expect(res.headers['set-cookie']).toBeTruthy()
  })

  it('Test 5: signup returns access and sets cookie', async () => {
    const email = `test-${Date.now()}@example.com`
    const password = 'password123'
    const res = await request(app).post('/api/auth/signup').send({ email, password })
    
    console.log('Test 5 - Status:', res.status)
    
    expect(res.status).toBe(200)
    expect(typeof res.body.access).toBe('string')
    expect(res.headers['set-cookie']).toBeTruthy()
  })
})
