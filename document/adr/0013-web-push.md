# ADR-0013: Web Push 알림 전략

- **Status**: Deferred
- **Date**: 2026-06-29
- **Depends on**: [ADR-0012](./0012-supabase-backend.md), [ADR-0014](./0014-production-auth-and-authorization.md)

## Context

> 2026-06-29 재검토에서 고객 알림 전체를 현재 범위에서 제외했다. Web Push,
> FCM, 알림톡 중 어느 방식도 지금 구현하지 않으며 알림 요구가 생길 때 새 ADR로
> 다시 비교한다.

포인트 적립·사용이 확정되면 인증된 고객의 기기에 알림을 보낸다. 브라우저가 임의 고객에게 알림을 발송하거나, 전화번호만 아는 제3자가 구독을 등록해서는 안 된다.

대안:

- **SMS/알림톡**: 도달률은 높지만 건당 비용, 공급자 계약, 메시지 심사가 필요하다.
- **Web Push**: 고객 동의와 브라우저 지원이 필요하지만 설치형 앱 없이 백그라운드 알림을 제공한다.

포인트 조회 인증에는 SMS OTP를 사용하지만 거래 알림은 Web Push를 사용한다.

## Decision

VAPID 기반 Web Push를 사용한다.

### 구독 등록

```text
고객 Phone OTP 인증
→ 고객 레코드와 auth.uid() 연결 확인
→ Service Worker 등록
→ 사용자가 "포인트 알림 받기" 선택
→ Notification.requestPermission()
→ pushManager.getSubscription() 확인
→ 없으면 pushManager.subscribe()
→ 인증된 subscribe-push 호출
→ auth.uid() 소유 고객의 customer_id에 endpoint upsert
```

- 알림 권한은 고객 인증 전이나 컴포넌트 마운트 시 자동 요청하지 않는다.
- `localStorage` 값으로 구독 여부를 판정하지 않는다.
- 전화번호를 request body의 권한 근거로 사용하지 않는다.
- endpoint는 unique index로 중복을 차단한다.

### 발송

```text
owner aal2 세션
→ 원자적 포인트 transaction
→ reward_log INSERT commit
→ Database Webhook
→ Supabase secret key로 인증된 send-push Edge Function
→ reward_log/customer/subscription 서버 조회
→ Web Push 발송
→ 결과 기록, 404/410 endpoint 삭제
```

- `OwnerRewardScreen`은 `send-push`를 직접 호출하지 않는다.
- 메시지의 `points_delta`와 `balance_after`는 확정된 DB event에서만 가져온다.
- webhook의 재시도에 대비해 reward event ID를 발송 idempotency key로 사용한다.
- 일부 endpoint 발송 실패가 포인트 transaction을 rollback하지 않는다.

### Service Worker와 PWA

- `push` handler는 payload를 검증하고 `event.waitUntil(self.registration.showNotification(...))`을 사용한다.
- `notificationclick` handler는 앱의 HTTPS URL을 열거나 기존 창을 focus한다.
- Web App Manifest에 `name`, `short_name`, `start_url`, `display`, `id`, 192/512 아이콘을 정의한다.
- 알림 badge와 icon을 same-origin 정적 파일로 제공한다.
- iOS 지원 안내는 실제 iOS/Safari 및 standalone 여부를 확인한 뒤 표시한다.

### secret

- `VITE_VAPID_PUBLIC_KEY`: Vercel client environment
- `VAPID_PRIVATE_KEY`: Supabase Edge Function Secrets
- 비공개 키는 `Deno.env.get('VAPID_PRIVATE_KEY')`으로만 읽는다.
- Edge Function 의존성은 함수 내부에서 버전을 고정하고 Deno/npm 호환성을 로컬과 배포 환경에서 테스트한다.

## Consequences

좋은 점:

- 인증된 고객만 자신의 구독을 등록·삭제할 수 있다.
- 클라이언트 위조 payload로 임의 Push를 보낼 수 없다.
- 포인트 확정 후 비동기 발송되므로 거래 무결성과 알림 장애가 분리된다.

비용과 제약:

- 고객이 브라우저 알림을 거부하면 발송할 수 없다.
- iOS는 홈 화면 설치와 플랫폼 조건이 필요하다.
- endpoint 만료·권한 철회·브라우저별 호환성을 지속적으로 관리해야 한다.
- Web Push는 전달을 보장하지 않으므로 거래 원장은 DB가 유일한 기준이다.

## 검증

- 인증되지 않은 구독 등록 거부
- 다른 고객의 `customer_id`로 구독 등록 거부
- 브라우저에서 `send-push` 호출 거부
- Supabase secret key 누락·오류 거부
- 동일 reward event 재전송 시 중복 알림 방지
- 404/410 endpoint 자동 삭제
- Android Chrome과 iOS 설치형 Web App 실기기 테스트

## 공식 근거

- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Supabase Push Notification Example](https://supabase.com/docs/guides/functions/examples/push-notifications)
- [Supabase Edge Function Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase Edge Function Authentication](https://supabase.com/docs/guides/functions/auth)
