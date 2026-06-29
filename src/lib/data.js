// 데모용 단일 데이터셋 — 손님/사장님 모든 화면이 이 데이터를 공유한다.
// 실 제품에서는 서버 API로 대체된다.

export const STORE_NAME = '달콤한 진스쿡'
export const STORE_TAGLINE = '김밥 · 샌드위치 전문점'

export const POINT_RATE = 0.05 // 결제금액의 5% 적립
export const REWARD_THRESHOLD = 5000 // 5,000P → 메뉴 1개 무료
export const STAMP_GOAL = 10 // 방문 도장 10개 → 김밥 1줄 무료

export const OWNER_PIN = '1234'

/** @typedef {{ type: 'earn' | 'use', label: string, amount: number, date: string }} HistoryEntry */
/** @typedef {{ phone: string, name: string, points: number, visits: number, lastVisit: string, history: HistoryEntry[] }} Customer */

/** @type {Customer[]} */
export const customers = [
  {
    phone: '01023457788',
    name: '김서연',
    points: 3420,
    visits: 18,
    lastVisit: '6월 26일',
    history: [
      { type: 'earn', label: '참치김밥 외 1', amount: 170, date: '6월 26일' },
      { type: 'use', label: '아메리카노 교환', amount: -2000, date: '6월 20일' },
      { type: 'earn', label: '에그 샌드위치', amount: 240, date: '6월 18일' },
      { type: 'earn', label: '소고기김밥', amount: 160, date: '6월 14일' },
    ],
  },
  {
    phone: '01098765432',
    name: '이준호',
    points: 5180,
    visits: 24,
    lastVisit: '6월 27일',
    history: [
      { type: 'earn', label: '베이컨 샌드위치', amount: 320, date: '6월 27일' },
      { type: 'earn', label: '치즈김밥 외 2', amount: 280, date: '6월 22일' },
      { type: 'use', label: '음료 교환', amount: -2500, date: '6월 15일' },
    ],
  },
  {
    phone: '01034561290',
    name: '박지우',
    points: 1240,
    visits: 7,
    lastVisit: '6월 25일',
    history: [
      { type: 'earn', label: '김치김밥', amount: 150, date: '6월 25일' },
      { type: 'earn', label: '햄치즈 샌드위치', amount: 200, date: '6월 19일' },
    ],
  },
  {
    phone: '01077880011',
    name: '최민재',
    points: 760,
    visits: 4,
    lastVisit: '6월 24일',
    history: [
      { type: 'earn', label: '멸치김밥', amount: 90, date: '6월 24일' },
      { type: 'earn', label: '참치김밥', amount: 130, date: '6월 17일' },
    ],
  },
  {
    phone: '01022334455',
    name: '정하윤',
    points: 2890,
    visits: 13,
    lastVisit: '6월 26일',
    history: [
      { type: 'earn', label: '불고기 샌드위치', amount: 260, date: '6월 26일' },
      { type: 'use', label: '김밥 1줄 교환', amount: -3000, date: '6월 21일' },
      { type: 'earn', label: '야채김밥 외 1', amount: 190, date: '6월 16일' },
    ],
  },
]

// 손님 랜딩 — 빠른 입력용 데모 칩
export const demoChips = [
  { phone: '01023457788', tag: '단골' },
  { phone: '01098765432', tag: '단골' },
  { phone: '01000000000', tag: '신규' },
]

// 대시보드 — KPI / 주간 매출
export const dashboard = {
  kpis: [
    { label: '오늘 적립', value: '14건', icon: '☕', tone: 'brand' },
    { label: '신규 손님', value: '3명', icon: '🌱', tone: 'leaf' },
    { label: '적립 포인트', value: '8,200P', icon: '⭐', tone: 'brand' },
  ],
  week: [
    { day: '월', value: 38 },
    { day: '화', value: 42 },
    { day: '수', value: 35 },
    { day: '목', value: 51 },
    { day: '금', value: 67 },
    { day: '토', value: 88 },
    { day: '일', value: 59, today: true },
  ],
}
