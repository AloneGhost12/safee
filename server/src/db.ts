import { MongoClient } from 'mongodb'
import pino from 'pino'

const log = pino()

let client: MongoClient | null = null

export async function connect() {
  if (client) return client
  const uri = process.env.MONGO_URI || ''
  if (!uri) {
    log.warn('MONGO_URI not set; database will not connect')
    throw new Error('MONGO_URI not set')
  }
  client = new MongoClient(uri)
  await client.connect()
  log.info('Connected to MongoDB')
  return client
}

export function getClient(): MongoClient {
  if (!client) throw new Error('MongoClient not connected')
  return client
}

export async function disconnect() {
  if (client) {
    await client.close()
    client = null
  }
}
