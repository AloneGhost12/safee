import { test, expect } from 'vitest'

test('simple test to check vitest is working', () => {
  expect(1 + 1).toBe(2)
  console.log('Simple test passed!')
})

test('another simple test', async () => {
  const promise = Promise.resolve('hello')
  const result = await promise
  expect(result).toBe('hello')
  console.log('Async test passed!')
})
