-- Basic Row Level Security (Phase 1 / Sprint 1 Task 4)
-- Refs: SPEC.md §6.2, override memo (employees do not authenticate in Phase 1).
--
-- Scope of this migration:
--   - Enable RLS on all 11 application tables.
--   - SELECT policies for every table, scoped by role (shacho / bizpla_bpo / workplace_admin).
--   - attendance_records: INSERT/UPDATE for management roles per SPEC §6.2.
--   - modification_requests: UPDATE (review) for management roles.
--   - All other mutations go through the admin client (server-only, RLS-bypassed)
--     until Sprint 3 introduces workplace_admin self-service write flows.
--
-- The `employee` role branch from SPEC §6.2 is intentionally omitted because
-- employees do not log in (override memo). Punching is performed via token-URL
-- + admin client.

BEGIN;

-- =============================================================
-- Helper functions
-- SECURITY DEFINER bypasses RLS on the users table when called from
-- inside other policies (avoids policy recursion).
-- =============================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_workplace_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workplace_id FROM public.users WHERE id = auth.uid();
$$;

-- Convenience: is this an organisation-wide role (sees the whole tenant)?
CREATE OR REPLACE FUNCTION public.current_user_is_org_wide()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('shacho', 'bizpla_bpo');
$$;

-- =============================================================
-- Enable RLS on every table
-- =============================================================
ALTER TABLE tenants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE workplaces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees             ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE break_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE modification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- tenants — own tenant only, read-only via RLS
-- =============================================================
CREATE POLICY tenants_select ON tenants
FOR SELECT USING (
  id = public.current_user_tenant_id()
);

-- =============================================================
-- workplaces
-- =============================================================
CREATE POLICY workplaces_select ON workplaces
FOR SELECT USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.current_user_is_org_wide()
    OR id = public.current_user_workplace_id()
  )
);

-- =============================================================
-- employees
-- =============================================================
CREATE POLICY employees_select ON employees
FOR SELECT USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.current_user_is_org_wide()
    OR workplace_id = public.current_user_workplace_id()
  )
);

-- =============================================================
-- users — every authenticated user can see members of their own scope
-- (org-wide for shacho/bpo, own workplace for workplace_admin).
-- =============================================================
CREATE POLICY users_select ON users
FOR SELECT USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.current_user_is_org_wide()
    OR workplace_id = public.current_user_workplace_id()
    OR id = auth.uid()
  )
);

-- =============================================================
-- attendance_records — SPEC §6.2 (without employee branch)
-- =============================================================
CREATE POLICY attendance_select ON attendance_records
FOR SELECT USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.current_user_is_org_wide()
    OR workplace_id = public.current_user_workplace_id()
  )
);

CREATE POLICY attendance_insert_management ON attendance_records
FOR INSERT WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.current_user_is_org_wide()
    OR (
      public.current_user_role() = 'workplace_admin'
      AND workplace_id = public.current_user_workplace_id()
    )
  )
);

CREATE POLICY attendance_update_management ON attendance_records
FOR UPDATE USING (
  tenant_id = public.current_user_tenant_id()
  AND status NOT IN ('locked', 'finalized')
  AND (
    public.current_user_is_org_wide()
    OR (
      public.current_user_role() = 'workplace_admin'
      AND workplace_id = public.current_user_workplace_id()
    )
  )
);

-- =============================================================
-- break_records — visibility follows the parent attendance record
-- =============================================================
CREATE POLICY break_records_select ON break_records
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM attendance_records ar
    WHERE ar.id = break_records.attendance_record_id
      AND ar.tenant_id = public.current_user_tenant_id()
      AND (
        public.current_user_is_org_wide()
        OR ar.workplace_id = public.current_user_workplace_id()
      )
  )
);

-- =============================================================
-- modification_requests
-- =============================================================
CREATE POLICY mod_requests_select ON modification_requests
FOR SELECT USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.current_user_is_org_wide()
    OR workplace_id = public.current_user_workplace_id()
  )
);

CREATE POLICY mod_requests_update_review ON modification_requests
FOR UPDATE USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.current_user_is_org_wide()
    OR (
      public.current_user_role() = 'workplace_admin'
      AND workplace_id = public.current_user_workplace_id()
    )
  )
);

-- =============================================================
-- calculation_rules / payroll_* / audit_logs
-- Phase 1: org-wide visibility only (workplace_admin sees own workplace
-- payroll list but not other workplaces).
-- Mutations here always go through the admin client.
-- =============================================================
CREATE POLICY calc_rules_select ON calculation_rules
FOR SELECT USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.current_user_is_org_wide()
    OR workplace_id = public.current_user_workplace_id()
  )
);

CREATE POLICY payroll_runs_select ON payroll_runs
FOR SELECT USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.current_user_is_org_wide()
    OR workplace_id = public.current_user_workplace_id()
  )
);

CREATE POLICY payroll_results_select ON payroll_results
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM payroll_runs pr
    WHERE pr.id = payroll_results.payroll_run_id
      AND pr.tenant_id = public.current_user_tenant_id()
      AND (
        public.current_user_is_org_wide()
        OR pr.workplace_id = public.current_user_workplace_id()
      )
  )
);

-- audit_logs: only org-wide roles can view (sensitive)
CREATE POLICY audit_logs_select_org_wide ON audit_logs
FOR SELECT USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_is_org_wide()
);

COMMIT;
