# jins_point_web

> 동네 단골을 위한, 전화번호만으로 쌓이는 포인트 — **달콤한 진스쿡**

김밥·샌드위치 전문점 "달콤한 진스쿡"을 가정한 포인트 적립 웹 프로토타입입니다. 손님은 별도 회원가입 없이 전화번호만으로 적립하고 조회하며, 사장님은 카운터에서 한 손으로 빠르게 적립을 처리합니다.

## 현재 단계

**사장님 흐름**

- ✅ **로그인** (4자리 PIN, 온스크린 키패드, 데모 PIN 1234 자동 입력)
- ✅ **적립 화면** (전화번호 + 결제금액 키패드 → 5% 자동 계산, 손님 매칭/신규 인식, 적립 완료 토스트)
- ✅ **손님 조회** (전화번호 검색, 단골 카드 그리드, 카드 펼쳐 상세 보기)
- ✅ **대시보드** (오늘 KPI 3종, 이번 주 매출 막대 그래프, 단골 TOP 3, 가게 정보, 로그아웃)
- 🧭 로그인 후 **상단 탭**으로 [적립 / 손님 조회 / 대시보드] 전환 (와이드 POS 레이아웃)

**손님 흐름**

- ✅ **랜딩** (브랜드 카드 + 전화번호 입력 + 데모 빠른 입력 칩)
- ✅ **내 포인트 조회** (큰 포인트 히어로, 다음 무료 메뉴까지 프로그레스, 방문 도장 10칸, 적립/사용 내역, 신규 손님 빈 상태)

> 이번 단계는 **UI 목업**입니다. 적립은 세션 메모리(`src/store.tsx`)에만 반영되며, 새로고침하면 초기화됩니다.
> 사장님/손님 모드는 페이지 상단의 "DEMO" 토글로 전환합니다 ([ADR-0006](./document/adr/0006-demo-mode-switcher.md)).

## 기술 스택

- **Vite 8** + **React 19**
- **Tailwind CSS v4** (`@tailwindcss/vite`, `@theme` 토큰)
- 상태 공유: React Context (`src/store.tsx`) — 적립이 조회·대시보드에 실시간 반영
- **TypeScript** (`strict: true`)
- 외부 폰트: Pretendard (CDN)

자세한 결정 배경은 [ADR](./document/adr) 참고.

## 시작하기

```bash
npm install
npm run dev
```

기본 주소: http://localhost:5173/

### 주요 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | dev 서버 실행 (HMR) |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 로컬 프리뷰 |
| `npm run lint` | oxlint |
| `npm run typecheck` | strict TypeScript 타입 검사 |

## 디자인 톤

크림 베이스 + 옐로우 브랜드 + 잉크 텍스트의 **밝고 따뜻한 동네 가게 감성**. (디자인 레퍼런스: [`document/prototype.html`](./document/prototype.html))

| 역할 | 컬러 |
|------|------|
| 베이스 | `#fcf7ec` (cream) |
| 메인 텍스트 | `#241b12` (ink) |
| 보조 텍스트 | `#9a8975` (ink-soft) |
| 브랜드 / 강조 | `#ffc81f` · `#f0a91a` (brand / brand-dark) |
| 성공 / 신규 | `#5e9c53` (leaf) |

토큰은 [`src/index.css`](./src/index.css)의 `@theme` 블록에 모여 있습니다. 톤을 조정하려면 여기를 먼저 보세요. 디자인 원칙은 [ADR-0005](./document/adr/0005-design-tone.md) 참고.

## 디렉토리 구조

```
.
├── document/
│   ├── adr/                    # Architecture Decision Records
│   └── prototype.html          # 디자인 레퍼런스 (번들된 목업)
├── public/
├── src/
│   ├── App.tsx                 # 데모 모드 스위처 + 화면 전환
│   ├── store.tsx               # 공유 상태 (손님 포인트, 적립 로그)
│   ├── index.css               # 디자인 토큰 (@theme) + 모션
│   ├── main.tsx
│   ├── lib/
│   │   ├── data.ts             # 단일 데이터셋 (손님, 대시보드, 상수)
│   │   └── format.ts           # 전화번호/금액/숫자 포맷
│   ├── ui/
│   │   ├── Logo.tsx            # 🍙 브랜드 로고
│   │   ├── Keypad.tsx          # POS 숫자/PIN 키패드
│   │   └── Toast.tsx           # 적립 완료 토스트
│   └── screens/
│       ├── OwnerLoginScreen.tsx           # 사장님 — 로그인 (PIN 키패드)
│       ├── OwnerRewardScreen.tsx          # 사장님 — 적립 (POS)
│       ├── OwnerCustomerSearchScreen.tsx  # 사장님 — 손님 조회
│       ├── OwnerDashboardScreen.tsx       # 사장님 — 대시보드
│       ├── CustomerLandingScreen.tsx      # 손님 — 랜딩
│       └── CustomerPointScreen.tsx        # 손님 — 내 포인트 조회
├── index.html
└── vite.config.ts
```

## 사용해보기

페이지 상단의 **DEMO 토글**로 사장님/손님 모드를 전환할 수 있습니다.

### 사장님 — 로그인 → 탭

1. 토글에서 **🧑‍🍳 사장님** 선택 → 로그인 화면 진입
2. 키패드로 PIN `1234` 입력 (또는 **DEMO · PIN 1234 자동 입력** 클릭)
3. "로그인" → 상단 탭으로 [☕ 적립 / 👥 손님 조회 / 📊 대시보드] 전환
4. 대시보드에서 로그아웃 가능

**적립 화면**: 전화번호 + 결제금액(키패드) 입력 → 5% 자동 계산 → "포인트 적립하기"

- 단골: `010-2345-7788` (김서연) → 보유 포인트·방문 횟수 표시, 적립 시 조회/대시보드에 반영
- 신규: `010-0000-0000` 같은 미등록 번호 → 🌱 신규 손님 뱃지

**손님 조회**: 검색창에 부분 번호 입력으로 필터, 또는 카드 클릭하면 상세(무료 메뉴까지·최근 방문·최근 내역) 펼침

**대시보드**: 오늘 KPI 3종 + 이번 주 매출 막대 그래프 + 단골 TOP 3 + 가게 정보

### 손님 — 랜딩 → 포인트 조회

1. 토글에서 **📱 손님** 선택 → 랜딩 화면 진입
2. 전화번호 입력 (또는 **DEMO 빠른 입력 칩** 클릭)
3. "내 포인트 보기" → 포인트 조회 화면으로 이동
4. 좌측 상단 **↻** 버튼 → 랜딩으로 돌아감

조회 화면에서 보는 것:

- 가장 크게 표시되는 사용 가능 포인트 (`010-2345-7788`은 `3,420P`)
- 다음 무료 메뉴(5,000P)까지 진행률 바
- 방문 도장 10칸 (방문 횟수 기준, 10개 모으면 김밥 1줄 무료)
- 적립/사용 내역 (🍙 적립, 🎁 사용)
- 등록 안 된 번호로 진입 시: 신규 손님 환영 + "이렇게 쌓여요" 빈 상태 카드

> 화면별 전체 체크리스트는 [수동 테스트 가이드](./document/manual-test-guide.md)를 참고하세요.

## 문서

- 📈 **[진행 상황](./document/progress.md)** — 화면별 완성도, 데이터 시드, 다음 단계 후보, TODO
- 🧪 **[수동 테스트 가이드](./document/manual-test-guide.md)** — 화면별 체크리스트와 시나리오
- [ADR 인덱스](./document/adr/README.md)
- [ADR-0001 기술 스택](./document/adr/0001-tech-stack.md)
- [ADR-0002 손님 식별](./document/adr/0002-phone-based-identification.md)
- [ADR-0003 매장 스코프](./document/adr/0003-single-store-scope.md)
- [ADR-0004 적립 정책](./document/adr/0004-percent-reward-policy.md)
- [ADR-0005 디자인 톤](./document/adr/0005-design-tone.md) (← 0008로 대체됨)
- [ADR-0006 화면 전환](./document/adr/0006-demo-mode-switcher.md)
- [ADR-0007 사장님 인증](./document/adr/0007-owner-authentication.md)
- [ADR-0008 디자인 톤 재정의 (달콤한 진스쿡)](./document/adr/0008-design-tone-jinscook.md)
