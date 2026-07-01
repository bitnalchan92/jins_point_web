# Task Completion

코딩 작업 완료 후 반드시 실행 (변경 범위에 맞는 테스트 포함):

```bash
npm run typecheck   # tsc -b — strict + noUncheckedIndexedAccess 통과 필수
npm run lint        # oxlint — 실제 이슈 0건 (pre-existing 경고만 허용)
npm run test        # 프론트 변경 시 (vitest)
npm run test:db     # DB/migration/RLS 변경 시 (pgTAP, 로컬 Supabase 필요)
npm run test:edge   # Edge Function 변경 시 (Deno)
npm run build       # 빌드 성공 확인
```

- TDD 흐름: 실패 테스트 작성(RED) → 구현 → 통과(GREEN) → 커밋. 단계별 커밋 권장.
- 커밋은 **self-contained** 해야 함: 새 공유 헬퍼 등 untracked 파일을 빠뜨리지 말 것 (`git status`로 확인).
- 보안 불변식: 브라우저 번들에 secret 없음, anon 테이블 직접 접근 없음, 포인트 확정값은 DB에서만 계산, 고객 응답에 PII 없음, 로그에 인증정보·전화번호 없음.
- `document/progress.md`의 **검증 상태** 표와 수동 가이드(`document/manual-test-guide.md`)도 갱신 대상.
