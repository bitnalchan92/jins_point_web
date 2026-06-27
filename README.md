# jins_point_web

> 동네 카페 단골을 위한, 전화번호만으로 쌓이는 따뜻한 포인트

음식점(특히 카페/디저트) 매장에서 사용할 수 있는 포인트 적립 웹 프로토타입입니다. 손님은 별도 회원가입 없이 전화번호만으로 적립하고 조회하며, 사장님은 카운터에서 한 손으로 빠르게 적립을 처리할 수 있습니다.

## 현재 단계

**사장님 흐름**

- ✅ **로그인** (4자리 PIN, 데모 PIN 1234 자동 입력 칩)
- ✅ **적립 화면** (전화번호 + 결제금액 → 5% 자동 계산, 신규 손님 자동 인식, 적립 완료 토스트)
- ✅ **손님 조회** (전화번호 검색, 단골 손님 리스트, 카드 펼쳐 상세 보기)
- ✅ **대시보드** (오늘 KPI 3종, 이번 주 매출 막대 그래프, 단골 TOP 3, 가게 정보, 로그아웃)
- 🧭 로그인 후 하단 탭바로 [적립 / 손님 조회 / 대시보드] 전환

**손님 흐름**

- ✅ **랜딩** (가게 카드 + 전화번호 입력 + 데모 빠른 입력 칩)
- ✅ **내 포인트 조회** (큰 포인트 카드, 다음 무료 음료까지 프로그레스, 도장 카드 5칸, 적립/사용 내역, 신규 손님 빈 상태)

> 이번 단계는 **UI 목업**에 집중합니다. 실제 동작하는 데이터 저장/적립 로직은 별도 단계에서 추가합니다.
> 사장님/손님 모드는 페이지 상단의 "데모 화면" 토글로 전환합니다 ([ADR-0006](./document/adr/0006-demo-mode-switcher.md)).

## 기술 스택

- **Vite 8** + **React 19**
- **Tailwind CSS v4** (`@tailwindcss/vite`, `@theme` 토큰)
- 자바스크립트 (현 단계 TS 미도입)
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

## 디자인 톤

크림 + 커피 브라운 + 카라멜 액센트의 **따뜻한 카페 감성**.

| 역할 | 컬러 |
|------|------|
| 베이스 | `#fbf7f1` (cream) |
| 메인 텍스트 | `#3d2817` (coffee-900) |
| 강조 / CTA | `#d97338` (caramel-500) |
| 성공 / 신규 | `#7a9e5b` (leaf-500) |

토큰은 [`src/index.css`](./src/index.css)의 `@theme` 블록에 모여 있습니다. 톤을 조정하려면 여기를 먼저 보세요. 디자인 원칙은 [ADR-0005](./document/adr/0005-design-tone.md) 참고.

## 디렉토리 구조

```
.
├── document/
│   └── adr/                    # Architecture Decision Records
├── public/
├── src/
│   ├── App.jsx                 # 데모 모드 스위처 + 화면 라우팅
│   ├── index.css               # 디자인 토큰 (@theme)
│   ├── main.jsx
│   ├── lib/
│   │   └── format.js           # 전화번호/금액 포맷, 공유 상수
│   └── screens/
│       ├── OwnerLoginScreen.jsx           # 사장님 — 로그인 (PIN)
│       ├── OwnerRewardScreen.jsx          # 사장님 — 적립 화면
│       ├── OwnerCustomerSearchScreen.jsx  # 사장님 — 손님 조회
│       ├── OwnerDashboardScreen.jsx       # 사장님 — 대시보드
│       ├── CustomerLandingScreen.jsx      # 손님 — 랜딩
│       └── CustomerPointScreen.jsx        # 손님 — 내 포인트 조회
├── index.html
└── vite.config.js
```

## 사용해보기

페이지 상단의 **데모 화면 토글**로 사장님/손님 모드를 전환할 수 있습니다.

### 사장님 — 로그인 → 탭바

1. 토글에서 **🧑‍🍳 사장님** 선택 → 로그인 화면 진입
2. PIN `1234` 입력 (또는 하단 **DEMO 자동 입력 칩** 클릭)
3. "로그인" → 하단 탭바로 [☕ 적립 / 👥 손님 조회 / 📊 대시보드] 전환
4. 대시보드 하단에서 로그아웃 가능

**적립 화면**: 전화번호 + 결제금액 입력 → 5% 자동 계산 → "포인트 적립하기"

- 신규: `010-5555-1111` 같은 임의 번호 → 🌱 신규 손님 뱃지
- 단골: `010-2345-7788` (시스템에 등록됨)

**손님 조회**: 검색창에 부분 번호 입력으로 필터, 또는 단골 손님 리스트에서 카드 클릭하면 상세 펼침

**대시보드**: 오늘 KPI 3종 + 이번 주 매출 막대 그래프 + 단골 TOP 3 + 가게 정보

### 손님 — 랜딩 → 포인트 조회

1. 토글에서 **📱 손님** 선택 → 랜딩 화면 진입
2. 전화번호 입력 (또는 하단 **DEMO 빠른 입력 칩** 클릭)
3. "내 포인트 보기" → 포인트 조회 화면으로 이동
4. 우측 상단 **↻** 버튼 → 랜딩으로 돌아감

조회 화면에서 보는 것:

- 가장 크게 표시되는 현재 포인트 (`010-2345-7788`은 `3,420P`)
- 다음 무료 음료(5,000P)까지 진행률 바
- 도장 카드 5칸 (1,000P당 1칸, 진행 중인 칸은 부분 채움)
- 적립/사용 내역 (☕ 적립, 🎁 사용)
- 등록 안 된 번호로 진입 시: 신규 손님 환영 + 빈 상태 카드

> 화면별 전체 체크리스트는 [수동 테스트 가이드](./document/manual-test-guide.md)를 참고하세요.

## 문서

- 📈 **[진행 상황](./document/progress.md)** — 화면별 완성도, 데이터 시드, 다음 단계 후보, TODO
- 🧪 **[수동 테스트 가이드](./document/manual-test-guide.md)** — 화면별 체크리스트와 시나리오
- [ADR 인덱스](./document/adr/README.md)
- [ADR-0001 기술 스택](./document/adr/0001-tech-stack.md)
- [ADR-0002 손님 식별](./document/adr/0002-phone-based-identification.md)
- [ADR-0003 매장 스코프](./document/adr/0003-single-store-scope.md)
- [ADR-0004 적립 정책](./document/adr/0004-percent-reward-policy.md)
- [ADR-0005 디자인 톤](./document/adr/0005-design-tone.md)
- [ADR-0006 화면 전환](./document/adr/0006-demo-mode-switcher.md)
- [ADR-0007 사장님 인증](./document/adr/0007-owner-authentication.md)
