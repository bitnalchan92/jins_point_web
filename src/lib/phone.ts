export function displayKoreanPhone(phoneE164: string): string {
  if (!/^\+82[0-9]{9,10}$/.test(phoneE164)) return phoneE164
  const domestic = `0${phoneE164.slice(3)}`
  if (domestic.length === 10) {
    return domestic.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  }
  return domestic.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
}
