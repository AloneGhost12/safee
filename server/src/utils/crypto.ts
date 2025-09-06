import argon2 from 'argon2'
import crypto from 'crypto'

export async function hashPassword(password: string) {
	return await argon2.hash(password, { type: argon2.argon2id })
}

export async function verifyPassword(hash: string, password: string) {
	return await argon2.verify(hash, password)
}

export function genSaltHex(len = 16) {
	return crypto.randomBytes(len).toString('hex')
}

