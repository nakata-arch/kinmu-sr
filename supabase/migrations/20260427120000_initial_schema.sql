-- Initial schema for kinmu-sr (Phase 1 / Sprint 1 Task 2)
-- Refs: SPEC.md §5 Data Model, override memo (employees.punch_token).
-- RLS is enabled in a separate migration (Sprint 1 Task 4).

BEGIN;

-- =============================================================
-- ENUM types (SPEC §5)
-- =============================================================
CREATE TYPE user_role         AS ENUM ('shacho', 'workplace_admin', 'employee', 'bizpla_bpo');
CREATE TYPE employment_type   AS ENUM ('regular', 'contract', 'part_time', 'arubaito', 'outsourcing');
CREATE TYPE attendance_status AS ENUM ('draft', 'submitted', 'approved', 'locked', 'finalized');
CREATE TYPE request_status    AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE payroll_status    AS ENUM ('draft', 'calculated', 'reviewing', 'finalized', 'exported');

-- =============================================================
-- 1. tenants (社労士事務所)
-- =============================================================
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  brand_name    TEXT NOT NULL,
  domain        TEXT,
  logo_url      TEXT,
  primary_color TEXT NOT NULL DEFAULT '#1F3A5F',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 2. workplaces (事業所)
-- =============================================================
CREATE TABLE workplaces (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug           TEXT NOT NULL,
  name           TEXT NOT NULL,
  bpo_plan       TEXT NOT NULL DEFAULT 'light',
  contract_start DATE NOT NULL,
  contract_end   DATE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  settings       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_workplaces_tenant ON workplaces(tenant_id);

-- =============================================================
-- 3. employees (従業員)
-- Override: punch_token (UNIQUE, NOT NULL) — 128-bit+ random URL token.
-- Employees do not authenticate via Supabase Auth in Phase 1; their
-- punch URL carries this token instead.
-- =============================================================
CREATE TABLE employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workplace_id    UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
  employee_code   TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  last_name_kana  TEXT,
  first_name_kana TEXT,
  department      TEXT,
  position        TEXT,
  employment_type employment_type NOT NULL DEFAULT 'regular',
  hired_at        DATE NOT NULL,
  terminated_at   DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  punch_token     TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (workplace_id, employee_code)
);

CREATE INDEX idx_employees_workplace ON employees(workplace_id);
CREATE INDEX idx_employees_active    ON employees(workplace_id, is_active)
  WHERE deleted_at IS NULL;

-- =============================================================
-- 4. users (Supabase auth.users 紐付け)
-- Role-specific NOT NULL constraints enforced via CHECK (SPEC §5.2.2).
-- =============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role          user_role NOT NULL,
  workplace_id  UUID REFERENCES workplaces(id) ON DELETE SET NULL,
  employee_id   UUID REFERENCES employees(id)  ON DELETE SET NULL,
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_shacho_or_bpo_no_scope CHECK (
    role NOT IN ('shacho', 'bizpla_bpo')
    OR (workplace_id IS NULL AND employee_id IS NULL)
  ),
  CONSTRAINT users_workplace_admin_has_workplace CHECK (
    role <> 'workplace_admin'
    OR (workplace_id IS NOT NULL AND employee_id IS NULL)
  ),
  CONSTRAINT users_employee_has_workplace_and_employee CHECK (
    role <> 'employee'
    OR (workplace_id IS NOT NULL AND employee_id IS NOT NULL)
  )
);

CREATE INDEX idx_users_tenant    ON users(tenant_id);
CREATE INDEX idx_users_workplace ON users(workplace_id);
CREATE INDEX idx_users_role      ON users(role);

-- =============================================================
-- 5. attendance_records (勤怠記録)
-- IP logging for punch traceability lives in audit_logs.metadata,
-- so no client_ip column is added here (override memo: minimal anti-spoof).
-- =============================================================
CREATE TABLE attendance_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workplace_id  UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id)  ON DELETE CASCADE,
  work_date     DATE NOT NULL,
  clock_in_at   TIMESTAMPTZ,
  clock_out_at  TIMESTAMPTZ,
  break_minutes INT  NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  absence_type  TEXT,
  note          TEXT,
  status        attendance_status NOT NULL DEFAULT 'draft',
  submitted_by  UUID REFERENCES users(id),
  submitted_at  TIMESTAMPTZ,
  approved_by   UUID REFERENCES users(id),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, work_date)
);

CREATE INDEX idx_attendance_workplace_date ON attendance_records(workplace_id, work_date);
CREATE INDEX idx_attendance_employee_date  ON attendance_records(employee_id, work_date DESC);
CREATE INDEX idx_attendance_status         ON attendance_records(workplace_id, status, work_date);

-- =============================================================
-- 6. break_records (休憩明細)
-- =============================================================
CREATE TABLE break_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  started_at           TIMESTAMPTZ NOT NULL,
  ended_at             TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_break_records_attendance ON break_records(attendance_record_id);

-- =============================================================
-- 7. modification_requests (修正依頼)
-- =============================================================
CREATE TABLE modification_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workplace_id         UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  requested_by         UUID NOT NULL REFERENCES users(id),
  request_type         TEXT NOT NULL,
  before_value         JSONB NOT NULL,
  after_value          JSONB NOT NULL,
  reason               TEXT NOT NULL,
  status               request_status NOT NULL DEFAULT 'pending',
  reviewed_by          UUID REFERENCES users(id),
  reviewed_at          TIMESTAMPTZ,
  review_comment       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mod_requests_workplace_status ON modification_requests(workplace_id, status);
CREATE INDEX idx_mod_requests_pending          ON modification_requests(workplace_id)
  WHERE status = 'pending';

-- =============================================================
-- 8. calculation_rules (給与計算ルール)
-- =============================================================
CREATE TABLE calculation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workplace_id    UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
  version         INT  NOT NULL CHECK (version > 0),
  effective_from  DATE NOT NULL,
  effective_until DATE,
  rules           JSONB NOT NULL,
  note            TEXT,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workplace_id, version)
);

CREATE INDEX idx_calc_rules_workplace ON calculation_rules(workplace_id, effective_from DESC);

-- =============================================================
-- 9. payroll_runs (給与計算実行履歴)
-- =============================================================
CREATE TABLE payroll_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workplace_id  UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
  target_month  DATE NOT NULL,
  rules_version INT  NOT NULL,
  status        payroll_status NOT NULL DEFAULT 'draft',
  calculated_at TIMESTAMPTZ,
  finalized_at  TIMESTAMPTZ,
  finalized_by  UUID REFERENCES users(id),
  summary       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workplace_id, target_month)
);

CREATE INDEX idx_payroll_runs_workplace_month ON payroll_runs(workplace_id, target_month DESC);

-- =============================================================
-- 10. payroll_results (従業員ごとの計算結果)
-- =============================================================
CREATE TABLE payroll_results (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id             UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id                UUID NOT NULL REFERENCES employees(id),
  total_work_minutes         INT  NOT NULL DEFAULT 0,
  regular_work_minutes       INT  NOT NULL DEFAULT 0,
  overtime_legal_minutes     INT  NOT NULL DEFAULT 0,
  overtime_statutory_minutes INT  NOT NULL DEFAULT 0,
  night_work_minutes         INT  NOT NULL DEFAULT 0,
  holiday_legal_minutes      INT  NOT NULL DEFAULT 0,
  holiday_company_minutes    INT  NOT NULL DEFAULT 0,
  over_60h_minutes           INT  NOT NULL DEFAULT 0,
  paid_leave_days            DECIMAL(4,1) NOT NULL DEFAULT 0,
  absence_days               DECIMAL(4,1) NOT NULL DEFAULT 0,
  late_minutes               INT  NOT NULL DEFAULT 0,
  early_leave_minutes        INT  NOT NULL DEFAULT 0,
  alerts                     JSONB NOT NULL DEFAULT '[]'::jsonb,
  details                    JSONB,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payroll_run_id, employee_id)
);

CREATE INDEX idx_payroll_results_run ON payroll_results(payroll_run_id);

-- =============================================================
-- 11. audit_logs (監査ログ)
-- IP / UA は metadata JSONB に格納する（override memo）
-- =============================================================
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id),
  actor_role    user_role,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   UUID,
  before_value  JSONB,
  after_value   JSONB,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_resource       ON audit_logs(resource_type, resource_id);

-- =============================================================
-- updated_at auto-update trigger
-- =============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_workplaces_updated_at
  BEFORE UPDATE ON workplaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_modification_requests_updated_at
  BEFORE UPDATE ON modification_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payroll_runs_updated_at
  BEFORE UPDATE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
