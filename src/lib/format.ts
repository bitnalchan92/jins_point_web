// 포맷 유틸 — 전화번호 / 금액 / 숫자

/** 입력값에서 숫자만 추출 (최대 11자리) */
export function onlyDigits(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '').slice(0, 11)
}

/** 010-1234-5678 형태로 포맷 */
export function formatPhone(raw: string | null | undefined): string {
  const d = onlyDigits(raw)
  if (d.length < 4) return d
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

/** 전화번호 유효성 (10~11자리) */
export function isValidPhone(raw: string | null | undefined): boolean {
  const len = onlyDigits(raw).length
  return len === 10 || len === 11
}

/** 천 단위 콤마 */
export function comma(n: number | string | null | undefined): string {
  return Number(n || 0).toLocaleString('ko-KR')
}

/** 금액 입력 포맷 (콤마 포함, 최대 7자리) */
export function formatAmount(raw: string | null | undefined): string {
  const d = (raw ?? '').replace(/\D/g, '').slice(0, 7).replace(/^0+/, '')
  return d ? comma(d) : ''
}
