# jins_point_web

> 동네 카페 단골을 위한, 전화번호만으로 쌓이는 따뜻한 포인트

음식점(특히 카페/디저트) 매장에서 사용할 수 있는 포인트 적립 웹 프로토타입입니다. 손님은 별도 회원가입 없이 전화번호만으로 적립하고 조회하며, 사장님은 카운터에서 한 손으로 빠르게 적립을 처리할 수 있습니다.

## 현재 단계

- ✅ **사장님 — 포인트 적립 화면** (전화번호 + 결제금액 → 5% 자동 계산, 신규 손님 자동 인식, 적립 완료 토스트)
- ⏳ 손님 — 내 포인트 조회
- ⏳ 손님 — 랜딩 (전화번호 입력)
- ⏳ 사장님 — 손님 조회/이력
- ⏳ 사장님 — 로그인 + 대시보드

> 이번 단계는 **UI 목업**에 집중합니다. 실제 동작하는 데이터 저장/적립 로직은 별도 단계에서 추가합니다.

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
│   └── adr/                # Architecture Decision Records
├── public/
├── src/
│   ├── App.jsx             # 현재는 사장님 적립 화면 한 장
│   ├── index.css           # 디자인 토큰 (@theme)
│   └── main.jsx
├── index.html
└── vite.config.js
```

## 사용해보기 (사장님 적립 화면)

1. 전화번호 입력 (예: `01055551111` → 자동 하이픈)
2. 결제금액 입력 (예: `12500`)
3. 미리보기 카드에 `625 P` 표시
4. "포인트 적립하기" 버튼 → 적립 토스트

**신규 손님 vs 단골** 차이를 보려면:

- 신규: `010-5555-1111` 같은 임의 번호
- 단골: `010-2345-7788` (목업 데이터에 등록되어 있음)

## 문서

- [ADR 인덱스](./document/adr/README.md)
- [ADR-0001 기술 스택](./document/adr/0001-tech-stack.md)
- [ADR-0002 손님 식별](./document/adr/0002-phone-based-identification.md)
- [ADR-0003 매장 스코프](./document/adr/0003-single-store-scope.md)
- [ADR-0004 적립 정책](./document/adr/0004-percent-reward-policy.md)
- [ADR-0005 디자인 톤](./document/adr/0005-design-tone.md)
