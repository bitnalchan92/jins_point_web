# Strict TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every JavaScript/JSX execution source to strict TypeScript without changing runtime behavior, UI, data, or business logic.

**Architecture:** Keep the current Vite, React Router, React Context, screen, and UI boundaries intact. Add TypeScript as a compile-time layer, define domain types at the data boundary, define the Context contract in the store, and type component props and events locally.

**Tech Stack:** TypeScript, React 19, Vite 8, React Router 7, oxlint, Tailwind CSS 4

---

### Task 1: Capture the JavaScript baseline

**Files:**
- Inspect: `package.json`
- Inspect: `src/**/*.js`
- Inspect: `src/**/*.jsx`

- [ ] **Step 1: Verify the current production build**

Run:

```bash
npm run build
```

Expected: exit code 0 and a Vite production bundle generated from `src/main.jsx`.

- [ ] **Step 2: Verify the current lint baseline**

Run:

```bash
npm run lint
```

Expected: exit code 0 with no lint errors.

- [ ] **Step 3: Record the current execution-source inventory**

Run:

```bash
rg --files src -g '*.js' -g '*.jsx'
```

Expected: 15 JavaScript/JSX source files. This list becomes the required rename checklist.

### Task 2: Add the strict TypeScript toolchain

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`

- [ ] **Step 1: Add compiler dependencies**

Run:

```bash
npm install --save-dev typescript @types/node
```

Expected: `typescript` and `@types/node` appear in `devDependencies`, and the lockfile is updated without changing existing dependency versions.

- [ ] **Step 2: Add the initially failing typecheck contract**

Add this script to `package.json`:

```json
"typecheck": "tsc -b"
```

Run:

```bash
npm run typecheck
```

Expected: failure because the referenced TypeScript project configuration and converted sources do not exist yet. This is the migration's red verification.

- [ ] **Step 3: Add the root project references**

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 4: Add strict browser-source settings**

Create `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Add strict Vite-config settings**

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

### Task 3: Convert shared data and formatting boundaries

**Files:**
- Rename: `src/lib/data.js` → `src/lib/data.ts`
- Rename: `src/lib/format.js` → `src/lib/format.ts`

- [ ] **Step 1: Rename the two non-JSX modules**

Run:

```bash
mv src/lib/data.js src/lib/data.ts
mv src/lib/format.js src/lib/format.ts
```

- [ ] **Step 2: Replace JSDoc data types with TypeScript types**

Define these contracts in `src/lib/data.ts` and annotate the existing values without changing them:

```ts
export type HistoryType = 'earn' | 'use'

export interface HistoryEntry {
  type: HistoryType
  label: string
  amount: number
  date: string
}

export interface Customer {
  phone: string
  name: string
  points: number
  visits: number
  lastVisit: string
  history: HistoryEntry[]
}

export interface DemoChip {
  phone: string
  tag: '단골' | '신규'
}
```

Annotate `customers` as `Customer[]` and `demoChips` as `DemoChip[]`. Define matching KPI/week/dashboard interfaces for the existing exported dashboard object.

- [ ] **Step 3: Type formatting inputs and outputs**

Use explicit signatures matching current call sites:

```ts
export function onlyDigits(raw: string | null | undefined): string
export function formatPhone(raw: string | null | undefined): string
export function isValidPhone(raw: string | null | undefined): boolean
export function comma(n: number | string | null | undefined): string
export function formatAmount(raw: string | null | undefined): string
```

Keep each existing function body unchanged.

### Task 4: Convert and type the React Context store

**Files:**
- Rename: `src/store.jsx` → `src/store.tsx`
- Modify: `src/store.tsx`

- [ ] **Step 1: Rename the store**

Run:

```bash
mv src/store.jsx src/store.tsx
```

- [ ] **Step 2: Define the store contracts**

Add contracts for the current data and return shapes:

```ts
export type RewardLogType = 'earn' | 'use'

export interface RewardLogEntry {
  id: number
  phone: string
  name: string
  earn: number
  type: RewardLogType
  time: string
}

type AddCustomerResult =
  | { success: true }
  | { success: false; error: 'invalid_phone' | 'duplicate' }

interface StoreContextValue {
  customers: Customer[]
  rewardLog: RewardLogEntry[]
  findCustomer: (raw: string) => Customer | null
  addReward: (rawPhone: string, amount: number | string) => { name: string; earn: number } | null
  redeemPoints: (
    rawPhone: string,
    amount: number | string,
  ) => { name: string; use: number; remaining: number } | null
  rate: number
  updateRate: (newRate: number) => void
  addCustomer: (phone: string, name: string) => AddCustomerResult
}
```

- [ ] **Step 3: Type Context, state, callbacks, and Provider props**

Use `createContext<StoreContextValue | null>(null)`, `PropsWithChildren` for the provider, `Record<string, number>` for point overrides, and `Customer[]`/`RewardLogEntry[]` for arrays that start empty or need a stable contract.

Keep all callback bodies, memo dependency lists, error behavior, calculations, and return values unchanged.

- [ ] **Step 4: Run the partial typecheck**

Run:

```bash
npm run typecheck
```

Expected: failure only from remaining `.jsx` imports/files and their untyped component boundaries; the shared data and store should no longer report errors.

### Task 5: Convert and type shared UI components

**Files:**
- Rename: `src/ui/Keypad.jsx` → `src/ui/Keypad.tsx`
- Rename: `src/ui/Logo.jsx` → `src/ui/Logo.tsx`
- Rename: `src/ui/Toast.jsx` → `src/ui/Toast.tsx`

- [ ] **Step 1: Rename UI modules**

Run:

```bash
mv src/ui/Keypad.jsx src/ui/Keypad.tsx
mv src/ui/Logo.jsx src/ui/Logo.tsx
mv src/ui/Toast.jsx src/ui/Toast.tsx
```

- [ ] **Step 2: Type keypad values and props**

Use the current key values without changing the arrays:

```ts
export type KeypadValue = string

export interface KeypadKey {
  label: string
  value: KeypadValue
  muted?: boolean
}

interface KeypadProps {
  keys: KeypadKey[]
  onPress: (value: KeypadValue) => void
}
```

- [ ] **Step 3: Type logo and toast props**

Use a closed logo-size union and string toast fields:

```ts
type LogoSize = 'sm' | 'md' | 'lg' | 'xl'

interface LogoProps {
  size?: LogoSize
  emoji?: string
  className?: string
}

export interface ToastConfig {
  icon: string
  title: string
  sub: string
}
```

Keep markup, class names, defaults, and exports unchanged.

### Task 6: Convert and type all screens

**Files:**
- Rename: `src/screens/CustomerLandingScreen.jsx` → `src/screens/CustomerLandingScreen.tsx`
- Rename: `src/screens/CustomerPointScreen.jsx` → `src/screens/CustomerPointScreen.tsx`
- Rename: `src/screens/OwnerLoginScreen.jsx` → `src/screens/OwnerLoginScreen.tsx`
- Rename: `src/screens/OwnerRewardScreen.jsx` → `src/screens/OwnerRewardScreen.tsx`
- Rename: `src/screens/OwnerCustomerManageScreen.jsx` → `src/screens/OwnerCustomerManageScreen.tsx`
- Rename: `src/screens/OwnerCustomerSearchScreen.jsx` → `src/screens/OwnerCustomerSearchScreen.tsx`
- Rename: `src/screens/OwnerDashboardScreen.jsx` → `src/screens/OwnerDashboardScreen.tsx`

- [ ] **Step 1: Rename all screen modules**

Run:

```bash
for file in src/screens/*.jsx; do mv "$file" "${file%.jsx}.tsx"; done
```

Expected: seven `.tsx` screen files and no `.jsx` files in `src/screens`.

- [ ] **Step 2: Type public screen props**

Add exact callback contracts:

```ts
interface CustomerLandingScreenProps {
  onSubmit: (phone: string) => void
}

interface CustomerPointScreenProps {
  phone: string
  onChangePhone: () => void
}

interface OwnerLoginScreenProps {
  onLogin: () => void
}

interface OwnerDashboardScreenProps {
  onLogout: () => void
}
```

- [ ] **Step 3: Type customer-management state and child props**

Use `Customer`, `ToastConfig`, and these current callback boundaries:

```ts
interface AddCustomerFormProps {
  onDone: (name: string) => void
  addCustomer: StoreContextValue['addCustomer']
}

interface CustomerCardProps {
  customer: Customer
  open: boolean
  onToggle: () => void
}
```

Type `expanded` as `string | null`, `toast` as `ToastConfig | null`, `nameRef` as `HTMLInputElement | null`, and the timer as `ReturnType<typeof setTimeout> | null`. Keep the original `null` timer initialization and use a compile-time-only non-null assertion when passing it to `clearTimeout`.

Apply the same `CustomerCardProps` contract and `string | null` expanded state to the retained, currently unreferenced `OwnerCustomerSearchScreen.tsx`; do not delete or connect that screen as part of this migration.

- [ ] **Step 4: Type reward modes, steps, and child props**

Define:

```ts
type RewardMode = 'earn' | 'use'
type RewardStep = 'search' | 'select' | 'amount'
```

Type `matches` as `Customer[]`, `resolved` as `Customer | null`, `toast` as `ToastConfig | null`, and all keypad/chip/select callbacks by their existing argument types. Narrow nullable state only at component boundaries where the existing state machine guarantees a selected customer.

- [ ] **Step 5: Type dashboard child props and events**

Type KPI tone as `'brand' | 'leaf'`, rate callbacks as `(rate: number) => void`, and keyboard events through inference from the JSX handler. Keep current parsing and save/cancel rules unchanged.

- [ ] **Step 6: Run the screen-level typecheck**

Run:

```bash
npm run typecheck
```

Expected: remaining errors should be limited to the unconverted app entry files or Vite config, not screen props or screen state.

### Task 7: Convert the application entry and Vite config

**Files:**
- Rename: `src/App.jsx` → `src/App.tsx`
- Rename: `src/main.jsx` → `src/main.tsx`
- Rename: `vite.config.js` → `vite.config.ts`
- Modify: `index.html`

- [ ] **Step 1: Rename entry and config files**

Run:

```bash
mv src/App.jsx src/App.tsx
mv src/main.jsx src/main.tsx
mv vite.config.js vite.config.ts
```

- [ ] **Step 2: Type route-local application state and props**

Define the existing tab values:

```ts
type OwnerTab = 'reward' | 'customers' | 'dashboard'

interface OwnerAppProps {
  tab: OwnerTab
  onTab: (tab: OwnerTab) => void
  onLogout: () => void
}
```

Type `customerPhone` as `string | null`. Preserve the current route tree, login state, tab initialization, logout behavior, and conditional rendering.

- [ ] **Step 3: Type the DOM root**

Change the explicit App import to `./App` and use the existing HTML invariant:

```ts
createRoot(document.getElementById('root')!).render(
```

Do not add a new runtime branch or error.

- [ ] **Step 4: Update the HTML module entry**

Change only this path in `index.html`:

```html
<script type="module" src="/src/main.tsx"></script>
```

- [ ] **Step 5: Verify no execution JavaScript remains**

Run:

```bash
rg --files src -g '*.js' -g '*.jsx'
find . -maxdepth 1 -name 'vite.config.js'
```

Expected: both commands produce no file paths.

### Task 8: Resolve strict errors without behavior changes

**Files:**
- Modify: converted `.ts` and `.tsx` files reporting compiler errors

- [ ] **Step 1: Run the full strict compiler**

Run:

```bash
npm run typecheck
```

Expected initially: compiler diagnostics identifying any remaining inaccurate contracts.

- [ ] **Step 2: Fix contracts at their narrowest boundary**

For each diagnostic:

- Prefer a precise union, imported domain type, or nullable state type.
- Use control-flow narrowing for real runtime branches.
- Use a local non-null assertion only for an invariant already guaranteed by the existing state machine or HTML.
- Do not add `any`, `@ts-ignore`, `@ts-expect-error`, new fallback behavior, or broad casts.
- Do not change conditional order, calculations, state updates, dependency arrays, JSX, classes, or text.

- [ ] **Step 3: Verify strict compilation**

Run:

```bash
npm run typecheck
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 4: Check forbidden type escapes**

Run:

```bash
rg -n '\bany\b|@ts-ignore|@ts-expect-error' src tsconfig*.json
```

Expected: no matches.

### Task 9: Update project documentation

**Files:**
- Modify: `README.md`
- Modify: `document/progress.md`

- [ ] **Step 1: Update README stack and paths**

Replace the statement that TypeScript is not introduced with strict TypeScript, update all `.js`/`.jsx` paths in the directory tree to `.ts`/`.tsx`, and add `npm run typecheck` to the scripts table. Do not change product descriptions or behavior documentation.

- [ ] **Step 2: Update progress status**

Mark TypeScript adoption complete, update the shared-store/data file extensions, and set type checking to passing only after Task 8 has produced an exit-code-0 result.

### Task 10: Run full regression verification

**Files:**
- Verify: all converted source and configuration files

- [ ] **Step 1: Run all static checks**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all three commands exit 0 with no compiler, lint, or build errors.

- [ ] **Step 2: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors; only TypeScript migration files and approved documentation are changed. Existing `.serena/` remains untracked and untouched.

- [ ] **Step 3: Run the existing core manual flows**

Start:

```bash
npm run dev
```

Verify:

- `/` renders the customer landing page and looks up demo customer `010-2345-7788`.
- `/admin` accepts PIN `1234`.
- Point, customer management, and dashboard tabs render.
- A point earn and a 1,000-point redemption produce the same results and toast messages documented in `document/manual-test-guide.md`.

- [ ] **Step 4: Commit the migration**

Stage only the migration files, excluding `.serena/`, and commit:

```bash
git add package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json index.html vite.config.ts src README.md document/progress.md docs/superpowers/plans/2026-06-29-typescript-migration.md
git commit -m "refactor: migrate app to strict TypeScript"
```
