# Tech Stack

## 프론트엔드
- **언어**: TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`)
- **프레임워크**: React 19 + React Router DOM 7
- **빌드**: Vite 8 (`@vitejs/plugin-react`)
- **스타일**: Tailwind CSS v4 (`@tailwindcss/vite` — config 파일 없음, CSS 내 `@theme`)
- **검증**: Zod (런타임 스키마 검증, `src/lib/contracts.ts`)
- **린터**: oxlint (`npm run lint`)
- **패키지 매니저**: npm

## 백엔드 (Supabase)
- **DB**: PostgreSQL + RLS (deny-by-default). 스키마는 `supabase/migrations/`.
- **인증**: Supabase Auth 이메일·비밀번호 + 필수 TOTP MFA (owner `aal2`). 고객은 무인증.
- **서버 로직**: Edge Functions (Deno, TypeScript) — `lookup-balance`, `owner-api`.
- **실시간**: private Realtime Broadcast (owner 전용 invalidation).
- **원자성**: PostgreSQL 함수 `apply_reward_transaction` (idempotency 포함).

## 봇 방어 / 레이트 리밋
- Cloudflare Turnstile (서버 Siteverify) + Upstash Redis (IP·전화번호·전역 다중 rate limit).

## 테스트
- pgTAP (DB/RLS) · Deno test (Edge) · vitest + Testing Library (프론트) · Playwright (E2E, staging).

## 배포 / CI
- Vercel (`vercel.json` — SPA rewrite + CSP/보안 헤더) + GitHub Actions (`.github/workflows/verify.yml`).

## 런타임 경계
- 브라우저 번들에는 publishable key만. secret(`VAPID_PRIVATE_KEY`, Turnstile secret, service key)은 Edge Function 전용.
