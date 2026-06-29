export function normalizeKoreanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!/^01[016789][0-9]{7,8}$/.test(digits)) {
    throw new Error('invalid_phone')
  }
  return `+82${digits.slice(1)}`
}

export async function hmacDigest(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
