const ITERATIONS = 100_000
const KEY_LEN = 32
const DIGEST = 'SHA-256'

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  
  const hash = await deriveHash(password, salt)
  return { hash, salt }
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const derived = await deriveHash(password, salt)
  return derived === hash
}

async function deriveHash(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))

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

  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}