# Suggested Commands

## 개발
```bash
npm run dev          # Vite dev server (HMR)
npm run build        # 프로덕션 빌드
npm run preview      # 빌드 결과 로컬 미리보기
```

## 검증 (정적)
```bash
npm run lint         # oxlint (실제 이슈 0건 기준; pre-existing 경고만 허용)
npm run typecheck    # tsc -b (strict, noUncheckedIndexedAccess)
```

## 테스트
```bash
npm run test         # 프론트 단위 테스트 (vitest + Testing Library)
npm run test:db      # DB/RLS pgTAP (로컬 Supabase 필요)
npm run test:edge    # Edge Function (Deno)  ← deno가 PATH에 있어야 함 (~/.deno/bin)
npm run test:e2e     # Playwright E2E (E2E_BASE_URL 등 staging secret 필요)
```

## 로컬 Supabase 스택 (DB/Edge 테스트 전제)
```bash
npx supabase start       # 최초 1회 Docker 이미지 다운로드 (수 분)
npx supabase db reset    # migrations + seed 재적용
npx supabase test db     # 모든 pgTAP 테스트
npx supabase gen types typescript --local   # database.types.ts 재생성
```

## 기타
```bash
git log --oneline    # 커밋 이력
```

> 태스크 완료 기준은 `mem:task_completion` 참고. 코딩 변경 후 typecheck·lint·해당 테스트·build를 모두 통과시킬 것.
