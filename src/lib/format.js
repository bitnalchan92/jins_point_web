export const POINT_RATE = 0.05
export const STORE_NAME = '진의 카페'
export const REWARD_THRESHOLD = 5000
export const POINTS_PER_STAMP = 1000

export function formatPhone(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length < 4) return d
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

export function formatAmount(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 7)
  if (!d) return ''
  return Number(d).toLocaleString('ko-KR')
}

export function maskPhone(phone) {
  const d = phone.replace(/\D/g, '')
  if (d.length < 8) return phone
  return `${d.slice(0, 3)}-****-${d.slice(7)}`
}

export const knownCustomers = new Set([
  '01023457788',
  '01033441290',
  '01088884444',
  '01077771234',
])
