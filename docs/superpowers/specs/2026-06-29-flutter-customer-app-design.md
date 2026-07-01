# Flutter Customer App Design

**Date:** 2026-06-29

**Status:** Deferred — no implementation planned

> 포인트 단독 네이티브 앱의 반복 가치가 부족하다고 판단해 이 설계는 보류했다.
> 현재 기준선은 [Web-Only Stage 2 Production Design](./2026-06-29-web-production-baseline-design.md)이다.
> 픽업 주문이 실제 출시 범위로 승인될 때 다시 검토한다.

## Goal

고객용 서비스를 Flutter 단일 코드베이스로 iOS와 Android에 제공한다. 사장님 운영 화면은 기존 React 웹을 유지하고, 두 클라이언트는 동일한 Supabase Auth·PostgreSQL·RLS·Edge Functions·Realtime 백엔드를 사용한다.

## 결정 요약

```text
고객
└── Flutter 앱
    ├── Android
    └── iOS

사장님
└── 기존 React 웹 /admin

공통 백엔드
└── Supabase
    ├── Auth
    ├── PostgreSQL + RLS
    ├── Edge Functions
    ├── private Realtime
    └── Database Webhook → FCM
```

## 범위

### 포함

- 고객 전화번호 기반 간편 잔액 조회
- SMS OTP 인증 후 상세 내역 조회
- SMS OTP 인증 후 FCM Push 등록
- 인증 고객의 개인정보 비노출 적립 QR/짧은 코드
- 적립·사용 결과 알림
- 인증된 고객의 private Realtime 갱신
- Android와 iOS의 개발·검증·스토어 배포
- dev/staging/production 환경 분리

### 제외

- 사장님 화면의 Flutter 전환
- Flutter Web
- 고객 앱에서 포인트 적립·사용 실행
- 오프라인 상태의 포인트 변경
- 다중 매장
- 앱 내 결제

## 코드베이스 경계

기존 React/Vite 프로젝트는 사장님 웹과 백엔드 문서의 기준으로 유지한다. Flutter 고객 앱은 같은 저장소의 독립 앱으로 둔다.

```text
/
├── src/                         # 기존 React 사장님 웹
├── supabase/                    # 공통 DB/Functions/Tests
├── apps/
│   └── customer_app/            # Flutter iOS/Android 앱
└── document/
```

React 컴포넌트와 TypeScript 상태 코드는 Flutter에서 직접 재사용하지 않는다. 다음 자산은 재사용한다.

- 브랜드 색상·타이포그래피·아이콘 원칙
- 화면 흐름과 문구
- DB schema와 RLS
- Edge Function API contract
- Auth와 포인트 정책
- Realtime topic contract
- Push payload contract

API request/response와 오류 코드는 문서화된 JSON contract로 고정해 TypeScript와 Dart가 같은 의미를 사용하게 한다.

## 글로벌 앱 벤치마크

대규모 서비스의 UI를 그대로 복제하지 않는다. 사용자 규모와 반복 사용으로 검증된 행동 패턴을 이 서비스의 작은 기능 범위에 맞게 축소 적용한다.

| 앱 | 규모 근거 | 채택할 패턴 | 채택하지 않을 것 |
|----|-----------|-------------|-------------------|
| McDonald’s | 2025년 말 70개 loyalty 시장, 90일 active loyalty 사용자 약 2.1억 명 | 한 번의 scan/code로 식별, 현재 포인트와 다음 보상 거리, 적립 누락 복구 경로 | 주문·배달·쿠폰 중심의 복잡한 탭 구조 |
| Starbucks | 2024년 말 미국 90일 active Rewards 회원 3,460만 명, 회원 결제 비중 60% | 큰 잔액, 다음 혜택 진행률, 등급/혜택의 명확한 설명, 개인화된 보상 | 선불카드·주문 기능 |
| Google Pay/Wallet | Google이 2020년에 공개한 월 사용자 1.5억 명·30개국 규모 | 홈에서 지금 필요한 정보 우선, 거래 내역의 명확한 상태, 개인정보 설정을 사용자가 통제 | 금융 계좌·결제 기능 |
| Duolingo | 2025년 3분기 일 사용자 5,000만 명 이상 | 즉각적인 성공 피드백, 명확한 진행도, 짧은 반복 동선, 대규모 실험 문화 | 방문 streak, 손실 회피를 이용한 과도한 gamification |
| Uber | 2025년 4분기 월간 active platform 사용자 2억 명 이상 | 첫 화면에서 다음 행동 하나를 우선, 현재 상태와 오류·복구를 투명하게 표현 | 여러 서비스가 섞인 super-app 구조 |

### 벤치마크에서 도출한 제품 원칙

1. **가치 먼저, 가입 나중:** 첫 실행에서 가입 carousel을 보여주지 않는다. 전화번호 입력 후 잔액 가치를 먼저 보여주고, 상세 내역·Push가 필요할 때 OTP를 요청한다.
2. **한 화면에 한 가지 핵심 질문:** 홈은 “현재 몇 포인트이고 다음 혜택까지 얼마나 남았나”에 답한다.
3. **숫자보다 보상 의미:** `3,420P`만 표시하지 않고 `1,580P 더 모으면 5,000P 혜택`처럼 다음 결과를 함께 보여준다.
4. **매장 동작을 한 번으로:** 인증 고객은 QR 또는 짧은 코드 하나로 식별한다. 적립과 사용 여부는 owner가 선택하므로 고객이 여러 코드를 고르지 않는다.
5. **성공을 즉시 확정:** 적립 후 animation/haptic/Push로 `+500P · 현재 3,920P`를 한 번에 확인시킨다.
6. **문제 해결을 숨기지 않음:** 최근 거래 옆에 `포인트가 안 들어왔나요?` 경로를 둔다.
7. **Gamification은 정직하게:** 실제 혜택 진행률은 강조하되 streak, 가짜 긴급성, 과도한 confetti는 사용하지 않는다.
8. **개인정보 제어권:** 알림과 개인화는 기본 opt-out이 아니라 명시적 동의를 받고 설정에서 언제든 해제한다.
9. **대규모 앱보다 단순하게:** 기능이 적으므로 4~5개 bottom tab을 복제하지 않는다.

## 고객 인증과 조회

### 단계 1: 간편 잔액 조회

SMS OTP 없이 전체 전화번호로 잔액을 조회할 수 있다.

```text
전화번호 입력
→ E.164 정규화
→ 앱 무결성 증명
→ lookup-balance Edge Function
→ 최소 응답 표시
```

허용 응답:

- 포인트 잔액
- 혜택 기준과 남은 포인트
- 가게 표시 정보

금지 응답:

- 고객 이름
- 방문 횟수
- 상세 적립·사용 내역
- 고객 ID와 auth user ID
- 전체 또는 마스킹되지 않은 전화번호

`customers`와 `reward_log`에는 anon RLS policy를 만들지 않는다. `lookup-balance` Edge Function만 secret-scoped DB client로 최소 DTO를 읽는다.

보호 수단:

- 전화번호 형식 검증
- IP·기기·전화번호 기반 rate limit
- 존재 여부를 과도하게 노출하지 않는 일관된 응답
- 전체 전화번호·잔액을 로그에 기록하지 않음
- Android는 Play Integrity, iOS는 App Attest/DeviceCheck 검증
- 위조·에뮬레이터·비정상 요청에는 허용/제한/추가 검증/거부의 단계적 정책 적용

이 모델은 전화번호를 아는 제3자가 잔액을 조회할 수 있다는 잔여 위험을 명시적으로 수용한다. 포인트 사용은 owner `aal2` 작업으로만 가능하고, 간편 조회 응답은 거래 내역이나 신원을 포함하지 않는다.

### 단계 2: 인증 고객 기능

상세 내역 또는 알림 받기를 선택할 때 SMS OTP로 전화번호 소유를 최초 확인한다.

```text
Phone OTP 요청
→ OTP 검증
→ Supabase customer session
→ JWT phone과 customer.phone_e164 연결
→ 본인 RLS 활성화
```

인증 후 허용:

- 상세 적립·사용 내역
- 본인 private Realtime
- FCM token 등록·해제
- 알림 설정

OTP는 매 조회마다 요구하지 않는다. 유효한 refresh session을 OS의 안전한 저장소에 보관한다. 로그아웃, 앱 데이터 삭제, 새 기기, 세션 만료, 전화번호 변경 때 다시 인증한다.

앱 설치나 FCM token만으로 고객 신원을 증명하지 않는다.

## 핵심 UI/UX

### 첫 실행

온보딩 carousel 없이 바로 전화번호 입력 화면을 표시한다.

```text
달콤한 진스쿡
내 포인트를 확인해 보세요

[010-0000-0000]
[포인트 확인]
```

- 숫자 keypad와 자동 formatting
- 붙여넣기 지원
- 입력 오류는 field 가까이 표시
- 개인정보 이용 목적을 한 문장으로 설명
- CTA는 유효한 전화번호일 때만 활성화
- 앱 무결성 검증과 네트워크 처리는 버튼 아래 inline progress로 표시
- OTP 화면에서는 Android SMS 자동완성·iOS one-time-code AutoFill을 지원하고, 붙여넣기도 막지 않음

### 간편 잔액 홈

화면 우선순위:

1. 현재 포인트
2. 다음 혜택까지 남은 포인트와 progress
3. 마지막 갱신 시각
4. `상세 내역·알림 연결` CTA
5. 매장 정보와 도움말

```text
안녕하세요

3,420 P
1,580P 더 모으면 5,000P 혜택
[█████████████──────] 68%

[상세 내역과 적립 알림 받기]
마지막 업데이트: 방금 전
```

간편 조회에서는 이름과 거래 내역을 보여주지 않는다. 화면 캡처와 최근 앱 화면에도 개인정보가 불필요하게 남지 않게 한다.

### 인증 홈

유효한 customer session이 있으면 전화번호 입력을 건너뛰고 바로 홈을 연다.

홈 구성:

- 큰 포인트 balance card
- 다음 실제 보상 progress
- `매장에서 적립하기` QR/짧은 코드 CTA
- 최근 거래 2~3개
- `전체 내역` 진입
- 알림 상태

기능 수가 적으므로 기본 구조는 single home + detail navigation으로 한다. bottom navigation은 사용성 test에서 홈/내역 간 왕복 문제가 확인될 때만 도입한다.

### 매장 적립 코드

McDonald’s의 scan/code 패턴을 현재 매장 흐름에 맞게 적용한다.

```text
고객: [매장에서 적립하기]
→ 60초 유효 QR + 6자리 fallback 코드
→ owner 웹이 scan 또는 숫자 입력
→ 서버가 challenge를 소비하고 owner 세션에 5분 유효 선택 handle 발급
→ 고객 확인
→ owner가 적립/사용과 금액 확정
```

보안 규칙:

- QR에는 전화번호나 customer ID를 넣지 않는다.
- QR에는 서버가 발급한 최소 128-bit entropy의 opaque random token만 넣는다.
- 6자리 fallback 코드는 같은 서버 측 challenge를 가리키며 owner 인증 뒤에만 조회할 수 있다.
- 서버에는 token/code 원문이 아니라 keyed digest, customer, 만료 시각, 사용 시각을 저장한다.
- token은 고객 식별만 하며 포인트 변경 권한을 갖지 않는다.
- owner가 코드를 확인하면 challenge를 잠그고 한 번만 소비하며, 현재 owner 세션에 묶인 5분 유효 선택 handle로 교환한다.
- 실제 적립·사용은 owner `aal2`와 원자적 transaction을 계속 요구하고, transaction에서 선택 handle도 한 번만 소비한다.
- 코드 조회는 owner·매장·IP 기준 rate limit과 실패 횟수 제한을 적용하고 실패 응답을 일반화한다.
- 새 코드를 발급하면 기존 미사용 코드를 폐기한다.
- screenshot 재사용을 줄이기 위해 만료 시 자동 갱신하고 남은 시간을 표시한다.

이 흐름은 카운터에서 전화번호를 소리 내어 말하는 개인정보 노출을 줄이고 owner의 뒷자리 검색 단계를 단축한다. 전화번호 뒷자리 입력은 앱이 없는 고객을 위한 fallback으로 유지한다.

### 적립 성공

앱이 foreground이면 Realtime 갱신 후 다음을 표시한다.

```text
+500P 적립됐어요
현재 3,920P
다음 혜택까지 1,080P
```

- 짧은 scale/fade animation
- 성공 haptic
- 숫자 변화 animation은 500ms 안팎의 짧은 범위
- screen reader에는 하나의 완료 문장으로 전달
- background/terminated 상태에서는 FCM Push가 같은 확정 정보를 전달

### 거래 내역과 복구

- 최신순 timeline
- `적립`, `사용`, `조정`을 색상뿐 아니라 icon/text로 구분
- 각 행에 변동 포인트, 확정 후 잔액, 일시 표시
- 날짜별 section
- skeleton과 empty state 분리
- `포인트가 안 들어왔나요?`에서 거래 시각·매장·영수증 정보를 제출하거나 매장 연락 방법 제공

### 알림 권한

첫 실행에 요청하지 않는다.

권장 시점:

1. OTP 인증 완료 직후 알림의 가치를 설명
2. 또는 첫 적립 성공 직후 `다음부터 바로 알려드릴까요?`
3. 사용자가 동의 CTA를 누른 뒤 OS permission prompt 표시

거부한 사용자에게 반복 팝업을 띄우지 않는다. 설정에서 상태와 OS 설정 이동 경로를 제공한다.

### 접근성·플랫폼 적응

- WCAG AA 수준의 text contrast
- 최소 44×44pt/iOS, 48×48dp/Android touch target
- Dynamic Type/text scaling에서 clipping 없음
- TalkBack/VoiceOver semantic label
- reduced motion 존중
- 색상만으로 상태를 표현하지 않음
- Android system back, iOS swipe-back 등 플랫폼 navigation 기대 준수
- Material/Cupertino component를 상황에 맞게 사용하되 브랜드 정보 구조는 동일하게 유지

## 사장님 인증

사장님은 기존 React `/admin`을 사용한다.

- Supabase 이메일·강한 비밀번호
- 필수 TOTP MFA
- owner 역할 + JWT `aal2`
- 모든 포인트 변경은 원자적 DB transaction
- 고객 앱과 독립된 session과 배포 주기

사장님 전용 앱은 이번 범위에 포함하지 않는다.

## Push

Web Push/VAPID/Service Worker를 제거하고 Firebase Cloud Messaging을 사용한다.

```text
Flutter 앱
→ 알림 권한 요청
→ FCM registration token 발급
→ 인증된 customer session으로 token 등록

owner 포인트 transaction commit
→ reward_log INSERT
→ Supabase Database Webhook
→ send-push Edge Function
→ FCM HTTP v1 API
→ Android FCM / iOS APNs
```

규칙:

- FCM token은 인증된 `auth.uid()`의 customer에만 연결한다.
- token이 변경되면 앱이 서버에 upsert한다.
- 로그아웃 시 해당 설치의 token 연결을 해제한다.
- invalid/unregistered token 응답은 DB에서 비활성화한다.
- reward event와 device token 조합으로 중복 발송을 방지한다.
- FCM service credential과 APNs key는 서버 secret으로만 보관한다.
- Android 13 이상은 `POST_NOTIFICATIONS`, iOS는 notification authorization을 사용자 맥락이 있는 시점에 요청한다.

## Realtime

- 인증 고객만 `customer:<auth_user_id>` private topic을 구독한다.
- 간편 잔액 조회 상태에서는 private Realtime을 제공하지 않는다.
- Realtime event는 invalidation signal로만 사용하고 RLS query로 다시 읽는다.
- 앱 background/resume과 network reconnect 때 authoritative state를 refetch한다.

## 플랫폼별 책임

### 공통 Flutter

- UI와 navigation
- Supabase session과 API client
- 전화번호 입력과 OTP
- balance/detail view model
- FCM token 등록 orchestration
- loading/error/retry
- analytics와 crash reporting의 privacy-safe wrapper

### Android

- Application ID와 Play signing
- `google-services.json`
- FCM notification channel
- `POST_NOTIFICATIONS`
- Play Integrity
- Android App Bundle
- Play Console internal/closed/production track

### iOS

- Bundle ID와 Apple signing/provisioning
- `GoogleService-Info.plist`
- Push Notifications capability와 APNs key
- notification authorization
- App Attest/DeviceCheck
- IPA archive
- TestFlight와 App Store Connect review

## 배포

하나의 Flutter commit에서 Android와 iOS release candidate를 만들 수 있지만 배포는 별도 파이프라인이다.

```text
공통 test
├── Android build/sign → Play internal test → review → release
└── iOS build/sign     → TestFlight          → review → release
```

iOS build/sign에는 macOS와 Xcode가 필요하다. 로컬 Mac 또는 보안이 설정된 macOS CI runner를 사용한다.

환경:

- dev: local Supabase와 test FCM
- staging: 별도 Supabase/Firebase project, TestFlight/Play internal
- production: production Supabase/Firebase project

각 환경은 application ID/bundle ID, API URL, publishable key, FCM 설정을 분리한다.

## App Store/Play 정책

- 개인정보처리방침과 계정·데이터 삭제 절차 제공
- 전화번호, 인증 정보, Push token의 수집·사용 목적 고지
- Play Data Safety와 App Store Privacy 응답 일치
- 로그인 기능 심사를 위한 demo/review 절차 제공
- 실제 기기에서 crash, background notification, 네트워크 복구 검증
- 웹 포장 앱이 아니라 native Push, secure session, Realtime, 앱 설정을 포함한 완성된 앱 경험 제공

## 오류 처리

- 간편 조회: 일반화된 조회 실패 응답으로 고객 존재 여부 노출 최소화
- OTP: 만료·잘못된 코드·rate limit을 구분하되 계정 enumeration 방지
- Push: token 등록 실패는 포인트 조회를 막지 않고 재시도 상태 표시
- Realtime: 연결 실패 시 수동 새로고침과 resume refetch 제공
- 무결성 API 장애: 낮은 위험의 잔액 조회에는 제한적 fallback, OTP 발송과 민감 작업에는 fail closed
- 포인트 원장은 Push/Realtime 성공 여부와 무관하게 DB transaction 결과만 기준으로 사용

## 제품 측정과 UX 검증

개발자의 취향이 아니라 실제 고객 행동으로 설계를 검증한다. 개인정보를 수집하지 않는 범위에서 다음 funnel을 측정한다.

```text
앱 실행
→ 전화번호 입력 완료
→ 잔액 조회 성공
→ OTP 시작
→ OTP 완료
→ 알림 opt-in
→ 적립 QR 사용
→ 30일 재방문
```

핵심 지표:

- 첫 실행부터 잔액 표시까지 걸린 시간
- 전화번호 입력 오류율
- 잔액 조회 성공률
- OTP 시작 대비 완료율
- OS 알림 permission 승인율
- QR scan 성공률과 fallback 코드 사용률
- 적립 후 앱/Push 확인률
- 누락 포인트 문의율
- crash-free session과 screen load latency

원칙:

- 인증·RLS·거래 무결성은 A/B test 대상이 아니다.
- 문구, CTA 위치, permission 요청 시점, progress 표현은 staging과 제한된 rollout에서 실험할 수 있다.
- 한 번에 하나의 가설만 검증한다.
- dark pattern으로 단기 opt-in을 올리지 않는다.

## UX 설계·검증 게이트

벤치마크는 출발점일 뿐 품질 보증이 아니다. 구현 전에 실제 매장 상황을 반영한 clickable prototype을 만들고, 대표 고객으로 형성 평가를 통과해야 한다.

대표 조건:

- 스마트폰 숙련도가 다른 고객
- 작은 글씨와 낮은 대비에 어려움이 있는 고객
- 밝은 매장, 한 손 사용, 불안정한 네트워크
- 기존 포인트 고객과 처음 방문한 고객

필수 과업:

1. 도움 없이 전화번호를 입력하고 잔액 확인
2. 다음 혜택까지 남은 조건 설명
3. OTP로 상세 내역 연결
4. 매장 QR/짧은 코드 제시
5. 최근 적립 확인
6. 누락 포인트 도움 경로 찾기
7. 알림 거부 후 설정 변경 경로 찾기

초기 통과 기준:

- 참여자 전원이 첫 시도에 현재 잔액을 찾음
- 80% 이상이 도움 없이 QR 또는 짧은 코드를 제시함
- 80% 이상이 다음 혜택 조건을 정확히 설명함
- 치명적 접근성 문제 0건
- 정상 네트워크에서 전화번호 제출 후 잔액 표시 p75 3초 이내
- task를 막는 오류 문구·복구 경로 문제 0건

평가에서 실패한 정보 구조와 문구는 코딩 전에 수정한다. 개발 후에는 Flutter widget/golden test, 실제 Android/iOS 기기, Play internal test/TestFlight 관찰로 다시 검증한다.

## 테스트

### 공통

- Dart unit/widget test
- API contract test
- 전화번호 정규화
- OTP state machine
- 인증/비인증 화면 분리
- FCM token upsert/logout

### Android

- 실제 기기 알림 권한
- foreground/background/terminated Push
- token rotation
- Play Integrity 허용·제한·거부
- internal track 설치

### iOS

- 실제 기기 APNs
- foreground/background/terminated Push
- notification permission 거부/재설정
- App Attest 정상·실패
- TestFlight 설치와 review account

### Backend

- anon table 접근 거부
- 최소 balance lookup DTO
- rate limit과 app integrity 검증
- OTP 고객의 본인 RLS
- 다른 고객 token 등록 거부
- 포인트 transaction idempotency
- FCM webhook 중복 발송 방지

## 전환 전략

1. 기존 React 고객 화면은 Flutter 앱 개발 중 demo/fallback으로 유지한다.
2. Supabase schema/RLS/원자적 포인트 transaction과 owner 웹을 먼저 안정화한다.
3. Flutter 앱을 staging backend에 연결한다.
4. Play internal test와 TestFlight로 실기기 검증한다.
5. 두 플랫폼 심사를 각각 제출한다.
6. 앱 배포 후 웹 고객 화면은 간편 조회 fallback 또는 앱 설치 안내로 축소한다.

## 공식 근거

- [McDonald’s 2025 Results — loyalty users](https://corporate.mcdonalds.com/content/dam/sites/corp/nfl/pdf/MCD%20Q4-25%20-%20Exhibit%2099.1%20-%20vF.pdf)
- [MyMcDonald’s Rewards flow](https://www.mcdonalds.com/us/en-us/mymcdonalds.html)
- [Starbucks Digital IR Dashboard](https://investor.starbucks.com/files/doc_financials/2025/q1/Q1-FY25-Digital-IR-Dashboard.pdf)
- [Starbucks 2026 Rewards update](https://about.starbucks.com/uploads/2026/03/Reimagined-Starbucks-Rewards-Program-Launches-with-New-Member-Benefits-2.pdf)
- [Google Pay product principles](https://blog.google/products-and-platforms/platforms/google-pay/reimagined-pay-save-manage-expenses-and-more/)
- [Duolingo 2025 active users](https://investors.duolingo.com/news-releases/news-release-details/duolingo-surpasses-50-million-daily-active-users-grows-dau-36)
- [Uber 2025 active users](https://investor.uber.com/news-events/news/press-release-details/2026/Uber-Announces-Results-for-Fourth-Quarter-and-Full-Year-2025/default.aspx)
- [Flutter supported platforms](https://docs.flutter.dev/reference/supported-platforms)
- [Flutter Android deployment](https://docs.flutter.dev/deployment/android)
- [Flutter iOS deployment](https://docs.flutter.dev/deployment/ios)
- [Supabase Flutter](https://supabase.com/docs/reference/dart/introduction)
- [Supabase Phone Login](https://supabase.com/docs/guides/auth/phone-login)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Firebase Cloud Messaging for Flutter](https://firebase.google.com/docs/cloud-messaging/flutter/client)
- [Android notification permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission)
- [Play Integrity](https://developer.android.com/google/play/integrity/overview)
- [Apple App Attest](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
