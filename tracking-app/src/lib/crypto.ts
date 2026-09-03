import bcrypt from 'bcryptjs-webcrypto'

const ROUNDS = 12
const LEGACY_PREFIX = 'pbkdf2$'

export async function hashPassword(password: string): Promise<{ hash: string }> {
  const hash = await bcrypt.hash(password, ROUNDS)
  return { hash }
}

export function isLegacyPasswordHash(stored: string): boolean {
  return stored.startsWith(LEGACY_PREFIX)
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (isLegacyPasswordHash(stored)) {
    const parts = stored.split('$')
    if (parts.length !== 3 || !parts[1] || !parts[2]) return false
    return verifyLegacyPassword(password, parts[2], parts[1])
  }

  return await bcrypt.compare(password, stored)
}

async function verifyLegacyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const ITERATIONS = 100_000
  const KEY_LEN = 32
  const DIGEST = 'SHA-256'

  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const saltBytes = new Uint8Array(salt.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: ITERATIONS,
      hash: DIGEST,
    },
    keyMaterial,
    KEY_LEN * 8
  )

  const derived = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return derived === hash
}
