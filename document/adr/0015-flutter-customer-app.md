# ADR-0015: 고객 클라이언트 — Flutter iOS/Android 앱

- **Status**: Deferred
- **Date**: 2026-06-29
- **Would supersede if resumed**: [ADR-0013](./0013-web-push.md)의 Web Push 방식
- **Amends**: [ADR-0010](./0010-react-router.md)의 프로덕션 고객 웹, [ADR-0014](./0014-production-auth-and-authorization.md)의 모든 조회 OTP 요구
- **Related**: [ADR-0012](./0012-supabase-backend.md)

## Context

> 2026-06-29 재검토에서 포인트 단독 앱은 설치를 정당화할 반복 가치가 부족하다고
> 판단했다. 현재는 React 고객 웹을 유지하며, 픽업 주문이 실제 출시 범위가 될 때
> 이 ADR을 다시 검토한다. 현재 기준은
> [Web-Only Stage 2 Production Design](../../docs/superpowers/specs/2026-06-29-web-production-baseline-design.md)이다.

고객은 포인트 잔액과 상세 내역을 확인하고 적립·사용 알림을 받는다. PWA/Web Push로 구현하면 Service Worker, VAPID, iOS 홈 화면 설치, 브라우저별 호환성 등 고객 가치와 직접 관계없는 복잡성이 커진다.

동시에 단순 잔액 조회마다 SMS OTP를 요구하면 고객 진입 장벽이 높다. 반면 Push와 상세 거래 내역은 전화번호를 아는 제3자에게 제공해서는 안 된다.

대안:

- **React PWA 유지**: 기존 코드를 활용하지만 iOS 설치와 Web Push 제약이 크다.
- **Flutter 고객 앱 + owner 웹 유지**: 고객은 iOS/Android 공통 앱, 사장님은 설치 없는 웹을 사용한다.
- **고객·owner 모두 Flutter**: 배포 대상과 권한 UI가 커지고 owner 운영 화면까지 스토어 배포에 종속된다.

## Decision

- 고객용 클라이언트는 Flutter 단일 코드베이스로 iOS와 Android에 제공한다.
- 사장님은 기존 React `/admin` 웹을 유지한다.
- 공통 백엔드는 Supabase Auth/PostgreSQL/RLS/Edge Functions/Realtime을 사용한다.
- Web Push를 제거하고 Firebase Cloud Messaging으로 전환한다.
- 잔액만 보는 간편 조회는 전체 전화번호 + 앱 무결성 검증 + rate limit으로 제공한다.
- 고객 이름·상세 내역·Realtime·Push 등록은 최초 SMS OTP 인증 후 제공한다.
- 고객 UI는 McDonald’s, Starbucks, Google Pay/Wallet, Duolingo, Uber의 대규모 사용 패턴을 벤치마킹하되 현재 기능 범위에 맞게 단순화한다.
- 가입 전 가치를 먼저 보여주고, 홈은 현재 포인트와 다음 실제 혜택까지의 진행률을 최우선으로 표시한다.
- 인증 고객에게 60초 유효 일회용 QR/짧은 코드를 제공해 전화번호를 말하지 않고 매장에서 식별되게 한다. 서버는 원문 대신 keyed digest를 저장한다. owner가 코드를 확인하면 challenge를 한 번만 소비하고 현재 owner 세션에 묶인 5분 유효 선택 handle로 교환하며, 포인트 transaction이 이 handle을 다시 한 번만 소비한다. 코드는 식별만 수행하며 포인트 변경 권한은 owner에게만 있다.
- 첫 실행에는 알림 권한을 요청하지 않고 OTP 완료 또는 첫 적립 성공 뒤 맥락을 설명한 후 요청한다.
- Android는 Play Integrity, iOS는 App Attest/DeviceCheck를 사용한다.
- iOS와 Android는 같은 Flutter 소스를 사용하지만 서명·권한·Push·스토어 심사는 별도 구성과 파이프라인으로 관리한다.
- 구현 전 대표 고객의 prototype 과업 평가를 통과하고, 출시 후 funnel·오류·접근성 지표로 검증한다.

## Security

- 앱 설치와 FCM token은 고객 신원 증명이 아니다.
- `customers`와 `reward_log`에 anon RLS policy를 만들지 않는다.
- 비인증 간편 조회는 Edge Function이 최소 balance DTO만 반환한다.
- 상세 내역과 Push token은 `auth.uid()` 소유권 RLS를 적용한다.
- 포인트 적립·사용은 owner `aal2`와 원자적 DB transaction을 계속 요구한다.
- FCM/APNs credential과 Supabase secret key는 앱 번들에 포함하지 않는다.
- UX 실험으로 인증·RLS·거래 무결성을 약화하지 않는다.

## Consequences

좋은 점:

- 고객 UI와 핵심 로직을 iOS/Android에서 공유한다.
- PWA 설치와 Web Push 제약이 사라진다.
- native Push와 secure session으로 고객 경험이 개선된다.
- owner 웹은 스토어 심사와 고객 앱 release cycle에 영향받지 않는다.

비용과 제약:

- 기존 React 고객 UI를 Dart/Flutter로 다시 작성해야 한다.
- iOS build/sign에는 macOS, Xcode, Apple Developer 설정이 필요하다.
- FCM, APNs, Play Integrity, App Attest의 플랫폼별 설정과 실기기 테스트가 필요하다.
- 두 스토어의 metadata, privacy disclosure, 심사와 release를 각각 관리해야 한다.
- 비인증 잔액 조회에는 전화번호를 아는 제3자가 잔액을 볼 수 있다는 제한된 잔여 위험이 남는다.

## 공식 근거

- [Flutter supported platforms](https://docs.flutter.dev/reference/supported-platforms)
- [Flutter Android deployment](https://docs.flutter.dev/deployment/android)
- [Flutter iOS deployment](https://docs.flutter.dev/deployment/ios)
- [Firebase Cloud Messaging for Flutter](https://firebase.google.com/docs/cloud-messaging/flutter/client)
- [Play Integrity](https://developer.android.com/google/play/integrity/overview)
- [Apple App Attest](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity)
