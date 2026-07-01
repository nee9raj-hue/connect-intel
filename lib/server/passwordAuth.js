import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(crypto.scrypt)

const MIN_PASSWORD_LENGTH = 8

export function validateEmailAddress(email) {
  const value = String(email || '').trim().toLowerCase()
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error('Enter a valid work email address')
  }
  return value
}

export function validatePassword(password, { forSignup = false } = {}) {
  const value = String(password || '')
  if (!value) throw new Error('Password is required')
  if (forSignup && value.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }
  return value
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = await scryptAsync(password, salt, 64)
  return `scrypt:${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || !String(storedHash).startsWith('scrypt:')) return false
  const [, salt, hashHex] = String(storedHash).split(':')
  if (!salt || !hashHex) return false
  const derived = await scryptAsync(password, salt, 64)
  const expected = Buffer.from(hashHex, 'hex')
  if (expected.length !== derived.length) return false
  return crypto.timingSafeEqual(expected, derived)
}
