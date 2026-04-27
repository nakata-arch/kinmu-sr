# SPEC.md — 社労士向け勤怠管理・給与計算システム

> **Purpose**: この文書は Claude Code（または他のAIコーディングエージェント）が本システムを実装するための一次情報源である。ここに書かれた内容は決定事項であり、実装中に曖昧さを感じた場合は必ずこの文書に立ち戻ること。この文書に書かれていない選択については、最後の「Open Questions」セクションに追記し、開発者（中田）に確認すること。

- **Project codename**: `kinmu-sr` （勤怠・社労士の略）
- **Client brand**: ノース社労士（第1号案件）
- **Document version**: v0.1
- **Last updated**: 2026-04-24
- **Author**: 株式会社ビジプラ

---

## Table of Contents

1. [Project Context](#1-project-context)
2. [Non-Negotiable Rules](#2-non-negotiable-rules)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Data Model](#5-data-model)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [API Specification](#7-api-specification)
8. [Rule Engine Detailed Design](#8-rule-engine-detailed-design)
9. [Screen Flow & User Journey](#9-screen-flow--user-journey)
10. [Implementation Phases](#10-implementation-phases)
11. [Operational Concerns](#11-operational-concerns)
12. [Open Questions](#12-open-questions)

---

## 1. Project Context

### 1.1 What we are building

社労士事務所が自社ブランドで顧問先（事業所）に提供できる、勤怠管理と給与計算のWebシステム。社労士事務所はこのシステムを販売することで新たな月額収益を得る。当社（ビジプラ）はシステムを開発・運用し、あわせてサポート業務をBPOで代行する。

### 1.2 Who uses this system

| Role | 日本語 | Examples | Device |
|---|---|---|---|
| `shacho` | 社労士 | ノース社労士の先生・職員 | PC（デスクトップ） |
| `workplace_admin` | 事業所管理者 | 顧問先企業の管理部長・上司 | PC（デスクトップ） |
| `employee` | 従業員 | 顧問先企業の従業員 | スマホ or 共有PC |

**重要な権限階層**: `shacho` > `workplace_admin` > `employee`。上位は下位のデータを閲覧可能、下位は上位のデータにアクセス不可。

### 1.3 What this system is NOT

- ❌ マイナンバー管理システムではない（絶対に扱わない）
- ❌ 給与振込システムではない（既存給与ソフトに任せる）
- ❌ 源泉徴収・年末調整システムではない
- ❌ 社会保険手続きシステムではない
- ❌ 汎用SaaSではない（ホワイトラベル前提のマルチテナント）

### 1.4 Scope of this SPEC

このSPEC.mdは **Phase 1（MVP）** と **Phase 2（ルールエンジン汎用化）** を網羅する。Phase 3 以降（横展開、他社労士事務所対応）は別途SPECを作成する。ただし、Phase 3 を見据えたマルチテナント設計は最初から入れる。

---

## 2. Non-Negotiable Rules

> ⚠️ **このセクションはAIが最も違反しやすい。実装中に何度でも参照すること。**

### 2.1 Data Rules（データに関する絶対事項）

- ✅ DO: 勤怠情報、勤怠に基づく計算結果、従業員の氏名・社員番号は扱う
- ❌ DON'T: マイナンバー、銀行口座番号、住所、生年月日、家族構成、健康情報は**スキーマに含めない**
- ❌ DON'T: 給与額そのものの最終確定は行わない（計算結果を出すのみで、振込データは作らない）
- ✅ DO: すべてのデータアクセスにRow Level Security（RLS）を適用する
- ✅ DO: すべての書き込み操作はログテーブルに記録する（誰が・いつ・何を変更したか）
- ❌ DON'T: 物理削除は原則しない。`deleted_at` でのソフトデリートのみ
- ✅ DO: タイムゾーンは必ず `Asia/Tokyo` で統一する。DBは `TIMESTAMPTZ` で保存し、表示時に変換

### 2.2 Code Rules（コードに関する絶対事項）

- ✅ DO: TypeScriptで全コードを書く。`any` 禁止。`unknown` を使い型絞り込み
- ✅ DO: Zodでリクエスト・レスポンスを検証する
- ❌ DON'T: `localStorage`/`sessionStorage`に機密データを保存しない
- ❌ DON'T: 日付・時刻計算を自力で書かない。必ず `date-fns` または `date-fns-tz` を使う
- ❌ DON'T: 金額計算に `Number` 型を使わない。勤怠時間は分単位の整数、給与関連は `decimal.js` で扱う
- ✅ DO: サーバー側計算ロジックは純関数として切り出し、単体テストを書く
- ❌ DON'T: ルールエンジンのロジックをフロント側に書かない。必ずサーバー側で実行

### 2.3 UI Rules（UIに関する絶対事項）

- ✅ DO: 日本語UIが第一優先。英語は技術用語・型名にのみ使う
- ✅ DO: 金額は `¥1,234,567` 形式、時間は `HH:MM` 形式で統一
- ✅ DO: 従業員画面は **3タップ以内** で打刻完了できること
- ✅ DO: 事業所の画面ブランド名・ロゴは設定から差し替え可能にする（ホワイトラベル）
- ❌ DON'T: 従業員が自分の勤怠を直接編集できるようにしない（必ず `workplace_admin` への依頼経由）
- ✅ DO: すべての破壊的操作（削除・確定）は確認ダイアログを挟む

### 2.4 Security Rules（セキュリティ絶対事項）

- ✅ DO: パスワードはSupabase Authに完全委譲する（自前で保存しない）
- ✅ DO: 全APIエンドポイントで認証チェック＋認可チェックを必ず行う
- ❌ DON'T: サービスロールキー（Supabase `service_role`）をクライアントに露出しない
- ✅ DO: 事業所管理者権限の二段階認証を必須にする
- ✅ DO: 社労士権限の二段階認証を必須にする
- ✅ DO: 従業員権限はパスワード＋招待コード方式（二段階認証は任意）

---

## 3. Technology Stack

### 3.1 確定スタック（選択肢は残さない）

| Layer | Choice | Version | Rationale |
|---|---|---|---|
| Frontend Framework | Next.js | 15.x | App Router、RSC、Vercelとの親和性 |
| Language | TypeScript | 5.x | 型安全性 |
| Styling | Tailwind CSS | 4.x | ユーティリティファースト |
| UI Components | shadcn/ui | latest | カスタマイズ可能なベース |
| Form | react-hook-form + Zod | latest | 型安全なフォーム |
| State (server) | TanStack Query | v5 | サーバー状態キャッシュ |
| State (client) | Zustand | 最新 | 軽量・必要最小限の使用 |
| Auth | Supabase Auth | latest | パスワード認証＋MFA |
| Database | PostgreSQL (Supabase) | 15+ | RLS、RPC、フルテキスト検索 |
| ORM / Query | Supabase client + 生SQL | latest | 複雑クエリは生SQL |
| Storage | Supabase Storage | latest | 打刻記録の証跡画像など |
| Date/Time | date-fns + date-fns-tz | latest | `Asia/Tokyo` 統一 |
| Decimal | decimal.js | latest | 金額・時間計算 |
| Validation | Zod | latest | ランタイム型検証 |
| Testing | Vitest + Playwright | latest | 単体・E2E |
| Hosting | Vercel | — | 国内リージョン |
| Monitoring | Sentry | — | エラー監視 |
| Linting | ESLint + Prettier | — | コード品質 |

### 3.2 禁止事項

- ❌ Redux / Recoil — 不要（Zustand で十分）
- ❌ styled-components / Emotion — Tailwind統一
- ❌ moment.js — date-fns統一
- ❌ lodash — 標準JS＋必要なら個別関数import
- ❌ Prisma ORM — Supabase純正＋生SQL（RLSとの相性優先）

### 3.3 Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # server-only, never expose

# App
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_BRAND_NAME=ノース社労士
NEXT_PUBLIC_BRAND_DOMAIN=kintai.north-sr.jp

# Email (for invitations, notifications)
RESEND_API_KEY=

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# Feature flags
NEXT_PUBLIC_ENABLE_SHARED_PC=true
```

---

## 4. System Architecture

### 4.1 High-level diagram

```
┌───────────────────────────────────────────────────────────────┐
│  Client (Browser / Mobile browser)                             │
│  ┌────────────┬─────────────────┬──────────────────────────┐  │
│  │ Employee   │ Workplace Admin │ Shacho Master            │  │
│  │ (SP/PC)    │ (PC)            │ (PC)                     │  │
│  └────────────┴─────────────────┴──────────────────────────┘  │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTPS
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  Next.js 15 on Vercel (App Router)                             │
│  ┌──────────────┬────────────────┬──────────────────────┐    │
│  │ RSC Pages    │ Route Handlers │ Server Actions       │    │
│  │ (UI render)  │ (API)          │ (mutations)          │    │
│  └──────────────┴────────────────┴──────────────────────┘    │
│                            │                                   │
│  ┌─────────────────────────▼────────────────────────────┐    │
│  │ Domain Layer                                          │    │
│  │  - Rule Engine (pure TypeScript)                      │    │
│  │  - Attendance Calculator                              │    │
│  │  - Payroll Summary Generator                          │    │
│  └─────────────────────────┬────────────────────────────┘    │
└────────────────────────────┼───────────────────────────────────┘
                             │ Supabase Client
                             ▼
┌───────────────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL + Auth + Storage + Realtime)             │
│  ┌──────────────┬────────────────┬──────────────────────┐    │
│  │ Auth         │ Tables (RLS)   │ RPC / Functions      │    │
│  └──────────────┴────────────────┴──────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

### 4.2 Directory structure

```
kinmu-sr/
├── src/
│   ├── app/
│   │   ├── (auth)/                    # ログイン・招待受け入れ
│   │   ├── (employee)/                # 従業員画面
│   │   │   ├── punch/                 # スマホ打刻
│   │   │   └── workplace/[slug]/      # 共有PC打刻
│   │   ├── (workplace)/               # 事業所管理者画面
│   │   │   ├── dashboard/
│   │   │   ├── attendance/
│   │   │   ├── requests/              # 修正依頼
│   │   │   └── employees/
│   │   ├── (shacho)/                  # 社労士マスター画面
│   │   │   ├── dashboard/
│   │   │   ├── workplaces/
│   │   │   ├── rules/
│   │   │   └── payroll/
│   │   ├── api/                       # Route Handlers
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                        # shadcn/ui
│   │   ├── employee/
│   │   ├── workplace/
│   │   └── shacho/
│   ├── domain/                        # 純粋ドメインロジック
│   │   ├── rule-engine/
│   │   │   ├── types.ts
│   │   │   ├── evaluator.ts
│   │   │   └── calculator.ts
│   │   └── attendance/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # browser
│   │   │   ├── server.ts              # RSC, Route Handler
│   │   │   └── admin.ts               # service_role (careful!)
│   │   ├── datetime.ts                # date-fns-tz wrappers
│   │   └── validators/                # Zod schemas
│   └── types/
│       └── database.ts                # Supabase generated types
├── supabase/
│   ├── migrations/                    # 順序付きSQL
│   ├── seed.sql
│   └── functions/                     # Edge Functions (必要時)
├── tests/
│   ├── unit/                          # Vitest
│   └── e2e/                           # Playwright
├── SPEC.md                            # この文書
├── CLAUDE.md                          # Claude Code用のワークフロー
└── package.json
```

### 4.3 Key design decisions

- **Server Actionsを優先、Route HandlersはAPI外部公開用**: フォーム送信等はServer Actionsで。外部連携が必要な場合だけRoute Handlers。
- **RSC（React Server Components）を基本とし、Client Componentsは最小限**: 打刻ボタン・インタラクティブなフォーム等だけ。
- **ドメインロジックは `src/domain/` に純関数として切り出す**: UI・DBに依存しない。単体テスト対象。
- **マルチテナント戦略**: 単一DBに全テナント。`tenant_id`（社労士事務所ID）ですべてのテーブルを分離。RLSで強制。

---

## 5. Data Model

### 5.1 ER overview

```
tenants (社労士事務所)
  ├─ users (アカウント)
  │    └─ (Supabase auth.users に紐付け)
  ├─ workplaces (事業所)
  │    ├─ employees (従業員)
  │    │    └─ attendance_records (勤怠記録)
  │    │         └─ modification_requests (修正依頼)
  │    ├─ calculation_rules (給与計算ルール)
  │    └─ payroll_runs (給与計算実行履歴)
  └─ audit_logs (監査ログ)
```

### 5.2 Table definitions

#### 5.2.1 `tenants`

社労士事務所のマスター。ホワイトラベル設定もここに持つ。

```sql
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,                    -- URL用 (例: 'north-sr')
  name        TEXT NOT NULL,                            -- 表示名 ('ノース社労士')
  brand_name  TEXT NOT NULL,                            -- ブランド表示名
  domain      TEXT,                                     -- カスタムドメイン
  logo_url    TEXT,
  primary_color TEXT DEFAULT '#1F3A5F',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 5.2.2 `users`

Supabase `auth.users` との紐付けテーブル。ロール情報を持つ。

```sql
CREATE TYPE user_role AS ENUM ('shacho', 'workplace_admin', 'employee', 'bizpla_bpo');

CREATE TABLE users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role             user_role NOT NULL,
  workplace_id     UUID REFERENCES workplaces(id) ON DELETE SET NULL, -- workplace_admin/employeeのみ
  employee_id      UUID REFERENCES employees(id) ON DELETE SET NULL,  -- employeeのみ
  display_name     TEXT NOT NULL,
  email            TEXT NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_workplace ON users(workplace_id);
CREATE INDEX idx_users_role ON users(role);
```

**制約**:
- `role='shacho'` の場合: `workplace_id` と `employee_id` は NULL
- `role='workplace_admin'` の場合: `workplace_id` は NOT NULL、`employee_id` は NULL
- `role='employee'` の場合: `workplace_id` と `employee_id` は NOT NULL
- `role='bizpla_bpo'` の場合: `workplace_id` と `employee_id` は NULL（社労士権限相当の別ロール、横断アクセス可）

#### 5.2.3 `workplaces`

事業所（顧問先企業）のマスター。

```sql
CREATE TABLE workplaces (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug              TEXT NOT NULL,                      -- URL用 (例: 'sample-corp')
  name              TEXT NOT NULL,                      -- 事業所名
  bpo_plan          TEXT NOT NULL DEFAULT 'light',      -- 'light'|'standard'|'premium'
  contract_start    DATE NOT NULL,
  contract_end      DATE,                               -- NULLなら無期限
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  settings          JSONB NOT NULL DEFAULT '{}'::jsonb, -- 事業所固有設定
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_workplaces_tenant ON workplaces(tenant_id);
```

#### 5.2.4 `employees`

事業所の従業員マスター。マイナンバー・住所等は持たない。

```sql
CREATE TYPE employment_type AS ENUM ('regular', 'contract', 'part_time', 'arubaito', 'outsourcing');

CREATE TABLE employees (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workplace_id         UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
  employee_code        TEXT NOT NULL,                  -- 事業所側の社員番号
  last_name            TEXT NOT NULL,
  first_name           TEXT NOT NULL,
  last_name_kana       TEXT,
  first_name_kana      TEXT,
  department           TEXT,
  position             TEXT,
  employment_type      employment_type NOT NULL DEFAULT 'regular',
  hired_at             DATE NOT NULL,
  terminated_at        DATE,                            -- 退職日
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  metadata             JSONB NOT NULL DEFAULT '{}'::jsonb, -- 役員フラグ等の柔軟属性
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ,
  UNIQUE(workplace_id, employee_code)
);

CREATE INDEX idx_employees_workplace ON employees(workplace_id);
CREATE INDEX idx_employees_active ON employees(workplace_id, is_active) WHERE deleted_at IS NULL;
```

#### 5.2.5 `attendance_records`

勤怠記録の中核テーブル。1日1レコード。

```sql
CREATE TYPE attendance_status AS ENUM (
  'draft',              -- 入力中（従業員が打刻中）
  'submitted',          -- 従業員が確定
  'approved',           -- 事業所管理者が承認
  'locked',             -- 月次締めでロック
  'finalized'           -- 給与計算で確定
);

CREATE TABLE attendance_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workplace_id      UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date         DATE NOT NULL,                         -- 対象日
  clock_in_at       TIMESTAMPTZ,                           -- 出勤打刻
  clock_out_at      TIMESTAMPTZ,                           -- 退勤打刻
  break_minutes     INT NOT NULL DEFAULT 0,                -- 休憩合計（分）
  absence_type      TEXT,                                  -- 'paid_leave'|'sick'|'special'|'absent'等
  note              TEXT,
  status            attendance_status NOT NULL DEFAULT 'draft',
  submitted_by      UUID REFERENCES users(id),             -- 入力者（従業員自身 or 管理者）
  submitted_at      TIMESTAMPTZ,
  approved_by       UUID REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, work_date)
);

CREATE INDEX idx_attendance_workplace_date ON attendance_records(workplace_id, work_date);
CREATE INDEX idx_attendance_employee_date ON attendance_records(employee_id, work_date DESC);
CREATE INDEX idx_attendance_status ON attendance_records(workplace_id, status, work_date);
```

**重要**:
- `clock_in_at`/`clock_out_at` は `TIMESTAMPTZ`。表示時に `Asia/Tokyo` に変換
- `break_minutes` は分単位整数（計算誤差を防ぐ）
- `work_date` は打刻時刻の日付とは必ずしも一致しない（深夜勤務で日をまたぐ場合あり）

#### 5.2.6 `break_records`

休憩の明細（複数回休憩を取るケースに対応）。

```sql
CREATE TABLE break_records (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id     UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  started_at               TIMESTAMPTZ NOT NULL,
  ended_at                 TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_break_records_attendance ON break_records(attendance_record_id);
```

#### 5.2.7 `modification_requests`

従業員から事業所管理者への修正依頼。

```sql
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE modification_requests (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workplace_id             UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
  attendance_record_id     UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  requested_by             UUID NOT NULL REFERENCES users(id),
  request_type             TEXT NOT NULL,                 -- 'clock_in'|'clock_out'|'break'|'absence'
  before_value             JSONB NOT NULL,                -- 変更前の値
  after_value              JSONB NOT NULL,                -- 変更後の値（希望）
  reason                   TEXT NOT NULL,
  status                   request_status NOT NULL DEFAULT 'pending',
  reviewed_by              UUID REFERENCES users(id),
  reviewed_at              TIMESTAMPTZ,
  review_comment           TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mod_requests_workplace_status ON modification_requests(workplace_id, status);
CREATE INDEX idx_mod_requests_pending ON modification_requests(workplace_id) WHERE status = 'pending';
```

#### 5.2.8 `calculation_rules`

事業所ごとの給与計算ルール。バージョン管理＋JSONB構造。

```sql
CREATE TABLE calculation_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workplace_id        UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
  version             INT NOT NULL,                     -- 1, 2, 3...
  effective_from      DATE NOT NULL,                    -- いつから有効か
  effective_until     DATE,                             -- NULLなら現在有効
  rules               JSONB NOT NULL,                   -- ルール本体（§8参照）
  note                TEXT,
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workplace_id, version)
);

CREATE INDEX idx_calc_rules_workplace ON calculation_rules(workplace_id, effective_from DESC);
```

#### 5.2.9 `payroll_runs`

給与計算の実行履歴。

```sql
CREATE TYPE payroll_status AS ENUM ('draft', 'calculated', 'reviewing', 'finalized', 'exported');

CREATE TABLE payroll_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workplace_id        UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
  target_month        DATE NOT NULL,                    -- 対象月（月初日）
  rules_version       INT NOT NULL,                     -- 使用したルールバージョン
  status              payroll_status NOT NULL DEFAULT 'draft',
  calculated_at       TIMESTAMPTZ,
  finalized_at        TIMESTAMPTZ,
  finalized_by        UUID REFERENCES users(id),        -- 必ず shacho
  summary             JSONB,                            -- サマリ数値
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workplace_id, target_month)
);

CREATE INDEX idx_payroll_runs_workplace_month ON payroll_runs(workplace_id, target_month DESC);
```

#### 5.2.10 `payroll_results`

従業員ごとの給与計算結果。

```sql
CREATE TABLE payroll_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id      UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES employees(id),
  total_work_minutes          INT NOT NULL DEFAULT 0,   -- 実働（分）
  regular_work_minutes        INT NOT NULL DEFAULT 0,   -- 所定内
  overtime_legal_minutes      INT NOT NULL DEFAULT 0,   -- 法定内残業
  overtime_statutory_minutes  INT NOT NULL DEFAULT 0,   -- 法定外残業
  night_work_minutes          INT NOT NULL DEFAULT 0,   -- 深夜労働
  holiday_legal_minutes       INT NOT NULL DEFAULT 0,   -- 法定休日労働
  holiday_company_minutes     INT NOT NULL DEFAULT 0,   -- 所定休日労働
  over_60h_minutes            INT NOT NULL DEFAULT 0,   -- 60時間超残業
  paid_leave_days             DECIMAL(4,1) NOT NULL DEFAULT 0,  -- 有給取得日数
  absence_days                DECIMAL(4,1) NOT NULL DEFAULT 0,  -- 欠勤日数
  late_minutes                INT NOT NULL DEFAULT 0,   -- 遅刻
  early_leave_minutes         INT NOT NULL DEFAULT 0,   -- 早退
  alerts                      JSONB NOT NULL DEFAULT '[]'::jsonb, -- 36協定警告等
  details                     JSONB,                    -- 計算過程の詳細
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(payroll_run_id, employee_id)
);

CREATE INDEX idx_payroll_results_run ON payroll_results(payroll_run_id);
```

#### 5.2.11 `audit_logs`

すべての書き込み操作の監査ログ。

```sql
CREATE TABLE audit_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id            UUID REFERENCES users(id),
  actor_role          user_role,
  action              TEXT NOT NULL,                    -- 'create'|'update'|'delete'|'approve'|'finalize'等
  resource_type       TEXT NOT NULL,                    -- 'attendance_record'|'rule'|'payroll'等
  resource_id         UUID,
  before_value        JSONB,
  after_value         JSONB,
  metadata            JSONB,                            -- IP、UAなど
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
```

### 5.3 TypeScript type definitions

```typescript
// src/types/database.ts
export type UserRole = 'shacho' | 'workplace_admin' | 'employee' | 'bizpla_bpo';
export type EmploymentType = 'regular' | 'contract' | 'part_time' | 'arubaito' | 'outsourcing';
export type AttendanceStatus = 'draft' | 'submitted' | 'approved' | 'locked' | 'finalized';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type PayrollStatus = 'draft' | 'calculated' | 'reviewing' | 'finalized' | 'exported';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  domain: string | null;
  logoUrl: string | null;
  primaryColor: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Workplace {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  bpoPlan: 'light' | 'standard' | 'premium';
  contractStart: string;
  contractEnd: string | null;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  tenantId: string;
  workplaceId: string;
  employeeCode: string;
  lastName: string;
  firstName: string;
  lastNameKana: string | null;
  firstNameKana: string | null;
  department: string | null;
  position: string | null;
  employmentType: EmploymentType;
  hiredAt: string;
  terminatedAt: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  workplaceId: string;
  employeeId: string;
  workDate: string;              // 'YYYY-MM-DD'
  clockInAt: string | null;      // ISO 8601
  clockOutAt: string | null;
  breakMinutes: number;
  absenceType: string | null;
  note: string | null;
  status: AttendanceStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ... 他のテーブルも同様
```

---

## 6. Authentication & Authorization

### 6.1 Authentication flow

1. **社労士・事業所管理者**: メール＋パスワード＋TOTP（二段階）
2. **従業員**: メール＋パスワード（または招待コード初回ログイン）
3. セッションはSupabase AuthのJWTをCookie保存

### 6.2 Authorization via RLS

すべてのテーブルでRLSを有効化する。以下は `attendance_records` の例。

```sql
-- Enable RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role/context
CREATE OR REPLACE FUNCTION auth.current_user_context()
RETURNS TABLE (
  user_id UUID,
  tenant_id UUID,
  role user_role,
  workplace_id UUID,
  employee_id UUID
) LANGUAGE sql STABLE AS $$
  SELECT id, tenant_id, role, workplace_id, employee_id
  FROM users
  WHERE id = auth.uid();
$$;

-- SELECT policy
CREATE POLICY "attendance_select" ON attendance_records
FOR SELECT USING (
  CASE
    -- 社労士: 自テナントの全事業所
    WHEN (SELECT role FROM users WHERE id = auth.uid()) = 'shacho'
      THEN tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    -- 事業所管理者: 自事業所のみ
    WHEN (SELECT role FROM users WHERE id = auth.uid()) = 'workplace_admin'
      THEN workplace_id = (SELECT workplace_id FROM users WHERE id = auth.uid())
    -- 従業員: 自分のデータのみ
    WHEN (SELECT role FROM users WHERE id = auth.uid()) = 'employee'
      THEN employee_id = (SELECT employee_id FROM users WHERE id = auth.uid())
    -- BPOオペレーター: 自テナントの全事業所（社労士相当）
    WHEN (SELECT role FROM users WHERE id = auth.uid()) = 'bizpla_bpo'
      THEN tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    ELSE FALSE
  END
);

-- INSERT policy（従業員は自分の当日打刻のみ）
CREATE POLICY "attendance_insert_employee" ON attendance_records
FOR INSERT WITH CHECK (
  (SELECT role FROM users WHERE id = auth.uid()) = 'employee'
  AND employee_id = (SELECT employee_id FROM users WHERE id = auth.uid())
  AND work_date = CURRENT_DATE
);

-- UPDATE policy（従業員は自分の当日かつstatus='draft'のみ、管理者以上はstatus='locked'/'finalized'以外）
CREATE POLICY "attendance_update" ON attendance_records
FOR UPDATE USING (
  CASE
    WHEN (SELECT role FROM users WHERE id = auth.uid()) = 'employee'
      THEN employee_id = (SELECT employee_id FROM users WHERE id = auth.uid())
           AND work_date = CURRENT_DATE
           AND status = 'draft'
    WHEN (SELECT role FROM users WHERE id = auth.uid()) IN ('workplace_admin', 'shacho', 'bizpla_bpo')
      THEN tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
           AND status NOT IN ('locked', 'finalized')
    ELSE FALSE
  END
);

-- DELETE is never allowed (soft delete only)
```

### 6.3 Permission matrix

| Action | shacho | workplace_admin | employee | bizpla_bpo |
|---|---|---|---|---|
| 全事業所を見る | ✅ | ❌ | ❌ | ✅ |
| 自事業所を見る | ✅ | ✅ | ❌ | ✅ |
| 自分の勤怠を見る | ✅ | ✅ | ✅ | ✅ |
| 打刻する | ❌ | ❌ | ✅ | ❌ |
| 勤怠を修正する | ✅ | ✅ | ❌ | ✅ |
| 修正依頼を出す | ❌ | ❌ | ✅ | ❌ |
| 修正依頼を承認する | ✅ | ✅ | ❌ | ✅ |
| ルールを設定する | ✅ | ❌ | ❌ | ✅ |
| 給与計算を実行する | ✅ | ❌ | ❌ | ✅ |
| 給与計算を**最終確定**する | ✅ | ❌ | ❌ | ❌ |
| 従業員を追加する | ✅ | ✅ | ❌ | ✅ |
| 事業所を追加する | ✅ | ❌ | ❌ | ✅ |

> ⚠️ **重要**: `bizpla_bpo` は `shacho` 相当の横断権限を持つが、**給与の最終確定だけはできない**。これは社労士の独占業務との法的境界のため。

---

## 7. API Specification

### 7.1 Design principles

- **Server Actions優先**: 通常のフォーム送信・データ更新はServer Actionsで
- **Route Handlers**: 外部連携（CSV出力・Webhook）・軽量なRead API
- **Response shape**: 成功時 `{ data: T }`、エラー時 `{ error: { code: string; message: string; details?: unknown } }`

### 7.2 Core Server Actions

#### 7.2.1 打刻

```typescript
// src/app/(employee)/punch/actions.ts
'use server';

import { z } from 'zod';

const PunchSchema = z.object({
  type: z.enum(['clock_in', 'clock_out', 'break_start', 'break_end']),
  deviceType: z.enum(['mobile', 'shared_pc']),
  employeeId: z.string().uuid().optional(),   // 共有PCの場合必須
});

export async function punchAction(input: z.infer<typeof PunchSchema>) {
  // 1. 認証チェック
  // 2. 入力検証
  // 3. 当日の attendance_record を upsert
  // 4. 打刻種別に応じて clock_in_at / clock_out_at / break_records を更新
  // 5. audit_log に記録
  // 6. 結果を返す
}
```

#### 7.2.2 修正依頼の作成

```typescript
const ModificationRequestSchema = z.object({
  attendanceRecordId: z.string().uuid(),
  requestType: z.enum(['clock_in', 'clock_out', 'break', 'absence']),
  afterValue: z.record(z.unknown()),
  reason: z.string().min(10).max(500),
});

export async function createModificationRequest(
  input: z.infer<typeof ModificationRequestSchema>
) { /* ... */ }
```

#### 7.2.3 修正依頼の承認/却下

```typescript
export async function reviewModificationRequest(
  requestId: string,
  decision: 'approve' | 'reject',
  comment?: string
) {
  // トランザクション内で:
  // 1. modification_requests.status を更新
  // 2. approveの場合、attendance_records を実際に更新
  // 3. audit_log に記録
}
```

#### 7.2.4 ルール保存

```typescript
export async function saveCalculationRules(
  workplaceId: string,
  rules: CalculationRules,         // §8 で定義
  effectiveFrom: string,
  note?: string
) {
  // 1. 現在のルールの effective_until を更新
  // 2. 新しいバージョンのルールを挿入
  // 3. audit_log に記録
}
```

#### 7.2.5 給与計算の実行

```typescript
export async function runPayrollCalculation(
  workplaceId: string,
  targetMonth: string,              // 'YYYY-MM'
  rulesVersion?: number             // 未指定なら最新
) {
  // 1. payroll_runs に draft レコード作成
  // 2. 対象月の attendance_records をすべて取得
  // 3. ルールエンジンで各従業員の結果を計算
  // 4. payroll_results に保存
  // 5. payroll_runs.status = 'calculated' に更新
}
```

#### 7.2.6 給与計算の最終確定（社労士のみ）

```typescript
export async function finalizePayroll(payrollRunId: string) {
  // 1. 現在のユーザーが shacho であることを必ず確認
  //    （bizpla_bpo は最終確定不可）
  // 2. payroll_runs.status = 'finalized' に更新
  // 3. 対応する attendance_records を 'finalized' に更新（ロック）
  // 4. audit_log に記録
}
```

### 7.3 Route Handlers (External APIs)

```
POST /api/export/csv
  - 給与計算結果をMFクラウド/freee/弥生形式のCSVで出力
  - Query: format=mf_cloud|freee|yayoi, payroll_run_id=UUID
  - Response: CSVファイル（Content-Disposition: attachment）

GET  /api/webhooks/reminders
  - Cron実行用: 打刻漏れ・締切接近を通知
  - 認証: secret header

GET  /api/health
  - ヘルスチェック
```

---

## 8. Rule Engine Detailed Design

### 8.1 Rules schema (JSONB structure)

```typescript
// src/domain/rule-engine/types.ts

export interface CalculationRules {
  version: number;
  basic: BasicRules;
  overtime: OvertimeRules;
  holiday: HolidayRules;
  allowance: AllowanceRules;
  special: SpecialRule[];
  employmentTypes: EmploymentTypeRules;
  agreement36: Agreement36Rules;
}

export interface BasicRules {
  scheduledWorkMinutesPerDay: number;   // 例: 480 (8h)
  scheduledStartTime: string;           // 'HH:MM'
  scheduledEndTime: string;
  breakMinutes: number;                 // デフォルト休憩時間
  breakAutoDeduct: boolean;
  breakAutoDeductThresholds: {
    workMinutes: number;
    deductMinutes: number;
  }[];                                  // [{480, 45}, {360, 45}] 等
  weeklyHolidays: ('mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun')[];
}

export interface OvertimeRules {
  definition: 'beyond_scheduled' | 'beyond_legal';
  requiresApproval: boolean;
  fixedOvertimeMinutes: number;         // みなし残業
  nightStartTime: string;               // '22:00'
  nightEndTime: string;                 // '05:00'
  over60hEnabled: boolean;              // 60h超の割増率引上げ対応
}

export interface HolidayRules {
  legalHoliday: 'sun' | 'sat' | 'mon' | string;   // 法定休日の曜日
  companyHolidays: string[];            // 所定休日の曜日
  nationalHolidayTreatment: 'company_holiday' | 'work_day' | 'legal_holiday';
  customHolidays: string[];             // 特定日付 'YYYY-MM-DD'
}

export interface AllowanceRules {
  weekdayOvertimeRate: number;          // 0.25 = 25%
  nightOvertimeRate: number;
  legalHolidayRate: number;             // 0.35
  companyHolidayRate: number;
  over60hRate: number;                  // 0.50
}

export interface SpecialRule {
  id: string;
  name: string;
  description: string;
  condition: RuleCondition;
  effect: RuleEffect;
  priority: number;                     // 適用順序（小さいほど先）
  isActive: boolean;
}

export type RuleCondition =
  | { type: 'department'; operator: 'equals' | 'in'; value: string | string[] }
  | { type: 'position'; operator: 'equals' | 'in'; value: string | string[] }
  | { type: 'employment_type'; operator: 'equals'; value: EmploymentType }
  | { type: 'monthly_minutes'; operator: 'gt' | 'gte' | 'lt' | 'lte'; value: number }
  | { type: 'and'; conditions: RuleCondition[] }
  | { type: 'or'; conditions: RuleCondition[] };

export type RuleEffect =
  | { type: 'fixed_overtime'; minutesPerMonth: number }
  | { type: 'custom_rate'; rateType: string; rate: number }
  | { type: 'warning'; message: string }
  | { type: 'exclude_overtime'; minutesPerMonth: number };

export interface EmploymentTypeRules {
  [K in EmploymentType]?: {
    includeInOvertimeCalc: boolean;
    scheduledWorkMinutesPerDay?: number;
    customRules?: Partial<CalculationRules>;
  };
}

export interface Agreement36Rules {
  monthlyLimitMinutes: number;          // 通常 45*60 = 2700
  yearlyLimitMinutes: number;           // 通常 360*60 = 21600
  specialClauseEnabled: boolean;
  specialClauseMonthlyLimit?: number;   // 通常 100*60 = 6000
  specialClauseYearlyLimit?: number;    // 通常 720*60 = 43200
  specialClauseMaxMonths?: number;      // 通常 6
  warningThresholdPercent: number;      // 例: 0.8 (80%超で警告)
}
```

### 8.2 Calculator (pure function)

```typescript
// src/domain/rule-engine/calculator.ts

export interface AttendanceDaily {
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  breakMinutes: number;
  absenceType: string | null;
}

export interface EmployeeCalcInput {
  employee: Employee;
  records: AttendanceDaily[];            // 1ヶ月分
  rules: CalculationRules;
}

export interface EmployeeCalcResult {
  totalWorkMinutes: number;
  regularWorkMinutes: number;
  overtimeLegalMinutes: number;
  overtimeStatutoryMinutes: number;
  nightWorkMinutes: number;
  holidayLegalMinutes: number;
  holidayCompanyMinutes: number;
  over60hMinutes: number;
  paidLeaveDays: number;
  absenceDays: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  alerts: Alert[];
  details: CalculationTrace;           // どのルールが適用されたか
}

export interface Alert {
  type: 'agreement36_monthly' | 'agreement36_yearly' | 'long_work' | 'custom';
  severity: 'info' | 'warning' | 'danger';
  message: string;
  value?: number;
  threshold?: number;
}

export function calculatePayrollForEmployee(
  input: EmployeeCalcInput
): EmployeeCalcResult {
  // Step 1: 各日の労働時間を計算
  // Step 2: 所定内・法定内残業・法定外残業・深夜・休日の分類
  // Step 3: SpecialRule を priority 順に適用
  // Step 4: 36協定チェック、アラート生成
  // Step 5: 結果を返す

  // 実装は純関数に保つこと（DBアクセスなし、副作用なし）
}
```

### 8.3 Calculation algorithm (核となるロジック)

以下のステップを**この順序で**実行する。

#### Step 1: 各日の労働時間を算出

```
For each work_date in target_month:
  if clock_in_at is null and clock_out_at is null:
    if absence_type == 'paid_leave': paid_leave_days += 1
    else if absence_type == 'absent': absence_days += 1
    continue
  
  work_minutes = diff_in_minutes(clock_out_at, clock_in_at) - break_minutes
  
  # 自動休憩控除（指定されていれば）
  if rules.basic.breakAutoDeduct:
    for threshold in rules.basic.breakAutoDeductThresholds:
      if work_minutes >= threshold.workMinutes:
        work_minutes -= max(0, threshold.deductMinutes - break_minutes)
        break
```

#### Step 2: 日単位で法定内・法定外・深夜・休日を分類

```
For each day:
  day_type = classify_day(work_date, rules.holiday)
  # day_type: 'weekday' | 'company_holiday' | 'legal_holiday' | 'custom_holiday'
  
  if day_type == 'legal_holiday':
    holiday_legal_minutes += work_minutes
    continue
  if day_type == 'company_holiday':
    holiday_company_minutes += work_minutes
    continue
  
  # 平日
  scheduled = rules.basic.scheduledWorkMinutesPerDay
  if work_minutes <= scheduled:
    regular_work_minutes += work_minutes
  else if work_minutes <= 480:  # 法定8h
    regular_work_minutes += scheduled
    overtime_legal_minutes += (work_minutes - scheduled)
  else:
    regular_work_minutes += scheduled
    overtime_legal_minutes += (480 - scheduled)
    overtime_statutory_minutes += (work_minutes - 480)
  
  # 深夜労働
  night_minutes = calculate_night_minutes(clock_in_at, clock_out_at, rules.overtime)
  night_work_minutes += night_minutes
```

#### Step 3: 月単位の累計処理

```
# みなし残業の控除
if rules.overtime.fixedOvertimeMinutes > 0:
  fixed = rules.overtime.fixedOvertimeMinutes
  overtime_total = overtime_legal_minutes + overtime_statutory_minutes
  if overtime_total <= fixed:
    overtime_legal_minutes = 0
    overtime_statutory_minutes = 0
  else:
    # みなし分を優先的に控除
    ...

# 60時間超の分類
if rules.overtime.over60hEnabled:
  if overtime_statutory_minutes > 60 * 60:
    over60h_minutes = overtime_statutory_minutes - 60 * 60
```

#### Step 4: SpecialRule の適用

```
# priority 昇順にソート
sorted_rules = sort(special_rules, by=priority)

for rule in sorted_rules:
  if not rule.isActive: continue
  if evaluate_condition(rule.condition, employee, result): 
    apply_effect(rule.effect, result)
```

#### Step 5: 36協定チェック

```
monthly_overtime = overtime_legal_minutes + overtime_statutory_minutes
monthly_limit = rules.agreement36.monthlyLimitMinutes
warning_threshold = monthly_limit * rules.agreement36.warningThresholdPercent

if monthly_overtime >= monthly_limit:
  alerts.append({type: 'agreement36_monthly', severity: 'danger', ...})
elif monthly_overtime >= warning_threshold:
  alerts.append({type: 'agreement36_monthly', severity: 'warning', ...})

# 年間チェックは過去11ヶ月分の合算で判定
```

### 8.4 Test cases

必ずテストすべき組み合わせ:

1. 所定8h・平日勤務・残業なし → 所定内のみカウント
2. 所定8h・平日9h勤務 → 所定内8h + 法定内残業1h
3. 所定8h・平日10h勤務 → 所定内8h + 法定内0h + 法定外2h
4. 深夜労働あり → 深夜時間帯を正しく集計
5. 法定休日労働 → holiday_legal_minutes に加算
6. 月をまたぐ深夜勤務 → work_dateに紐付け、深夜集計が正しい
7. みなし残業40h・実残業30h → 残業0h
8. みなし残業40h・実残業50h → 超過10hが計上
9. 有給休暇 → paid_leave_days に加算、労働時間は0
10. 36協定月45h超 → dangerアラート生成
11. SpecialRule（営業部のみなし残業） → 条件一致時のみ適用
12. 週40h超過（法定） → 週次での残業集計

---

## 9. Screen Flow & User Journey

### 9.1 URL structure

```
# 従業員
/punch                                # スマホ打刻（自分のID紐付け）
/w/[workplace-slug]                   # 共有PC 従業員一覧
/w/[workplace-slug]/punch/[emp-code]  # 共有PC 打刻ダイアログ

# 事業所管理者
/admin/dashboard
/admin/attendance                     # 勤怠一覧
/admin/attendance/[record-id]         # 勤怠詳細・修正
/admin/requests                       # 修正依頼
/admin/employees                      # 従業員管理

# 社労士
/master/dashboard
/master/workplaces                    # 事業所一覧
/master/workplaces/[id]               # 事業所詳細
/master/workplaces/[id]/rules         # ルール設定
/master/payroll/[workplace-id]/[YYYY-MM]  # 給与計算
```

### 9.2 State machine: Attendance record

```
draft ──(submit)──> submitted ──(approve)──> approved ──(month_close)──> locked ──(payroll_finalize)──> finalized

各状態からの操作可否:
  draft:      本人のみ編集可
  submitted:  管理者が承認/却下可、本人は編集不可
  approved:   管理者・社労士が編集可（要修正依頼）
  locked:     社労士のみ編集可
  finalized:  編集不可（給与確定済み）
```

### 9.3 State machine: Payroll run

```
draft ──(calculate)──> calculated ──(review)──> reviewing ──(finalize by shacho)──> finalized ──(export)──> exported
```

### 9.4 Critical user flows

#### Flow A: 従業員がスマホで出勤打刻

```
1. スマホでURL開く
2. 未ログインなら: ログイン画面 → 認証
3. /punch 画面表示（本人情報）
4. 「出勤」ボタンタップ
5. punchAction サーバーアクション実行
6. 当日の attendance_record を upsert（なければ作成、あれば更新）
7. 成功メッセージ＋最終打刻を更新表示
```

#### Flow B: 従業員が修正依頼

```
1. /punch から「今月の勤怠」タップ
2. 過去の勤怠一覧表示
3. 対象日を選択
4. 修正内容＋理由を入力
5. 「依頼する」で modification_requests に挿入
6. 事業所管理者にメール通知
```

#### Flow C: 事業所管理者が修正依頼を承認

```
1. /admin/requests で pending 一覧
2. カード内で Before/After 確認
3. 「承認」ボタン
4. トランザクション内で:
   - modification_requests.status = 'approved'
   - 対象の attendance_records を更新
   - audit_logs に記録
5. 従業員にメール通知
```

#### Flow D: 社労士が給与計算を確定

```
1. /master/payroll/[workplace]/[month] 
2. 事前チェック: 勤怠の確定率、修正依頼残数を表示
3. 「ルール適用して計算」ボタン → runPayrollCalculation
4. 結果一覧表示、36協定警告ハイライト
5. 必要なら「再計算」で Step 3 に戻る
6. 「最終確定」ボタン（shachoのみ可視）
7. 確認ダイアログ
8. finalizePayroll 実行
9. CSV出力画面へ遷移
```

---

## 10. Implementation Phases

### 10.1 Phase 1: MVP（5〜6週間）

**Goal**: ノース社労士の1事業所で実運用開始できる最小版

#### Sprint 1 (Week 1-2): 基盤

- [ ] プロジェクト雛形（Next.js 15 + TypeScript + Tailwind + shadcn/ui）
- [ ] Supabaseプロジェクト作成、全テーブルのマイグレーション
- [ ] Supabase Auth連携、ユーザー作成フロー
- [ ] 基本的なRLSポリシー
- [ ] CI/CD（GitHub Actions → Vercel）

#### Sprint 2 (Week 3): 従業員打刻

- [ ] スマホ打刻画面（`/punch`）
- [ ] 共有PC従業員一覧（`/w/[slug]`）
- [ ] 共有PC打刻ダイアログ
- [ ] 打刻Server Action（4種類: clock_in/out/break_start/break_end）
- [ ] 当日打刻ログ表示

#### Sprint 3 (Week 4): 事業所管理者

- [ ] ログイン・ダッシュボード
- [ ] 勤怠一覧画面（月別・部署フィルタ）
- [ ] 勤怠修正画面（インライン編集）
- [ ] 修正依頼の作成・承認フロー
- [ ] 従業員マスターの追加・編集

#### Sprint 4 (Week 5): 社労士・計算エンジン

- [ ] 社労士ダッシュボード
- [ ] ルールエンジンの基本実装（special_ruleは後回し）
- [ ] 給与計算実行（Step 1-3のみ、Step 4 SpecialRuleはPhase 2）
- [ ] 結果表示・CSV出力（MFクラウド形式のみ）
- [ ] 最終確定フロー

#### Sprint 5 (Week 6): 仕上げ・リリース準備

- [ ] 監査ログ全面適用
- [ ] E2Eテスト（主要フロー）
- [ ] エラー監視（Sentry）
- [ ] ノース社労士向け初期データ投入
- [ ] 運用ドキュメント

### 10.2 Phase 2: ルールエンジン拡張（4〜6週間）

- [ ] SpecialRule完全実装（condition・effect）
- [ ] ルール設定UI（ノーコード）
- [ ] ルールバージョン管理・シミュレーション
- [ ] 36協定の年次累計判定
- [ ] 異常検知ロジック強化
- [ ] freee・弥生形式のCSV出力追加
- [ ] 月次レポート機能

### 10.3 Phase 3: 横展開準備（Phase 2終了後）

- [ ] テナント追加オンボーディングの自動化
- [ ] ブランド設定の完全動的化
- [ ] 複数事務所対応の負荷テスト
- [ ] ドキュメント・動画マニュアル

---

## 11. Operational Concerns

### 11.1 Logging & Monitoring

- **Sentry**: エラー監視。フロント・バック両方。
- **Supabase Logs**: DBクエリ、RLSポリシー違反のモニタリング
- **Custom audit logs**: すべての書き込み操作を `audit_logs` に記録

### 11.2 Backup & Disaster Recovery

- Supabaseの日次自動バックアップ（7日保持）を有効化
- 重要テーブル（`attendance_records`, `payroll_results`）は週次で別リージョンに論理バックアップ
- Point-in-Time Recoveryをenable

### 11.3 Scaling considerations

- 1テナント = 1社労士事務所、30事業所、1000従業員まではSupabase Pro で十分
- 将来的にテナントDB分離する場合に備え、`tenant_id` は全テーブル必須

### 11.4 Security hardening

- CSP（Content Security Policy）を設定
- HSTS有効化
- Rate limiting（Vercel機能 or middleware）
- セッション固定化攻撃対策（Supabase Auth標準）
- CSRF対策（Server Actionsは標準で対策済み）

### 11.5 Compliance

- 個人情報保護法: 勤怠情報は個人情報に該当。取扱規程を整備
- プライバシーマーク取得を中期目標とする
- データ保持期間: 契約終了後2年で自動削除（法定最低3年だが社労士が既存保管）

---

## 12. Open Questions

> このセクションはAIが埋めず、開発中に疑問が出たら追記すること。開発者（中田）と相談して決定する。

- [ ] 従業員のログイン方式: 招待リンク＋初回パスワード設定か、社員番号＋PINか
- [ ] 共有PC利用時の本人確認強化: 顔認証？社員証QR？（ナシでOKならスキップ）
- [ ] 打刻時のGPS取得: ON/OFFの事業所別設定を持つか
- [ ] ノース社労士既存の顧問先データフォーマット: Dropboxの中身を確認後に決定
- [ ] ブランドロゴ・カラーの反映範囲: メール通知にも入れるか
- [ ] 通知手段: メールのみか、LINE連携まで入れるか
- [ ] 給与ソフト連携: 優先度はMFクラウド＞freee＞弥生＞汎用CSV でOKか
- [ ] Phase 1 MVP の「最初の1事業所」選定: 具体的な候補は？
- [ ] 本番環境URLとサブドメイン構成: `kintai.north-sr.jp` でSSL発行するか、当社ドメインの下に置くか
- [ ] BPOオペレーターの業務画面: Phase 1では社労士画面を兼用でOKか、別画面が必要か

---

## Appendix A: Glossary

| Term | 日本語 | Description |
|---|---|---|
| Tenant | テナント | 社労士事務所 |
| Workplace | 事業所 | 社労士の顧問先企業 |
| Employee | 従業員 | 事業所で働く人 |
| Shacho | 社労士 | システムのマスター権限者 |
| BPO | Business Process Outsourcing | 当社が社労士事務所の職員として代行する業務 |
| 36協定 | Agreement 36 | 労働基準法第36条に基づく時間外労働協定 |
| 所定労働時間 | Scheduled work time | 就業規則で定められた労働時間 |
| 法定労働時間 | Legal work time | 労基法上の上限（8h/日・40h/週） |
| 法定休日 | Legal holiday | 労基法上の休日（週1日以上） |
| 所定休日 | Company holiday | 会社独自の休日（土曜等） |
| みなし残業 | Fixed overtime | あらかじめ給与に含まれる残業分 |

## Appendix B: References

- 労働基準法: https://elaws.e-gov.go.jp/document?lawid=322AC0000000049
- 社労士法: https://elaws.e-gov.go.jp/document?lawid=343AC0000000089
- Supabase RLS best practices: https://supabase.com/docs/guides/auth/row-level-security
- Next.js 15 App Router: https://nextjs.org/docs/app

---

## How to use this SPEC with Claude Code

1. **最初に**: このSPEC.md全体を読み込ませる
2. **機能追加時**: 該当セクションを `@SPEC.md#N.M` 形式で参照
3. **違反チェック**: Section 2 のルールに違反していないか、PRレビュー時に必ず確認
4. **追加Q&A**: Section 12 に追記し、決定後は本文に反映、Open Questionsから削除

```bash
# 開始コマンド例
claude "SPEC.md を読んで Phase 1 Sprint 1 のタスクを順に実装してください。
       不明な点は Section 12 Open Questions に追記してください。"
```
