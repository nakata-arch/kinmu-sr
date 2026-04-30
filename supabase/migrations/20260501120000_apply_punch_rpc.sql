-- Single-round-trip punch RPC.
-- Sprint 2 perf fix: collapses what was 5–9 sequential round trips
-- (resolve employee → load attendance → load open break → mutate →
--  recompute breaks → audit log → revalidate-triggered re-render queries)
-- into one server-side function call.
--
-- Called only from the Server Action via the admin client. RLS is
-- bypassed by service_role; the function itself is INVOKER so anon /
-- authenticated callers cannot use it directly to insert attendance
-- they shouldn't.

CREATE OR REPLACE FUNCTION public.apply_punch(
  p_punch_type     text,
  p_token          text  DEFAULT NULL,
  p_workplace_slug text  DEFAULT NULL,
  p_employee_id    uuid  DEFAULT NULL,
  p_punch_method   text  DEFAULT 'token',
  p_client_ip      text  DEFAULT NULL,
  p_user_agent     text  DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  v_now              timestamptz := NOW();
  v_work_date        date        := (v_now AT TIME ZONE 'Asia/Tokyo')::date;
  v_employee         employees%ROWTYPE;
  v_attendance       attendance_records%ROWTYPE;
  v_open_break_id    uuid;
  v_open_break_at    timestamptz;
  v_state            text;
  v_attendance_id    uuid;
  v_total_break_min  int;
BEGIN
  -- 1. Resolve employee
  IF p_token IS NOT NULL THEN
    SELECT * INTO v_employee FROM employees
    WHERE punch_token = p_token
      AND is_active = TRUE
      AND deleted_at IS NULL;
  ELSIF p_workplace_slug IS NOT NULL AND p_employee_id IS NOT NULL THEN
    SELECT e.* INTO v_employee
    FROM employees e
    JOIN workplaces w ON w.id = e.workplace_id
    WHERE e.id = p_employee_id
      AND w.slug = p_workplace_slug
      AND e.is_active = TRUE
      AND e.deleted_at IS NULL;
  END IF;

  IF v_employee.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'employee_not_found');
  END IF;

  -- 2. Today's attendance
  SELECT * INTO v_attendance FROM attendance_records
  WHERE employee_id = v_employee.id AND work_date = v_work_date;
  v_attendance_id := v_attendance.id;

  -- 3. Open break (if any)
  IF v_attendance_id IS NOT NULL THEN
    SELECT id, started_at INTO v_open_break_id, v_open_break_at
    FROM break_records
    WHERE attendance_record_id = v_attendance_id AND ended_at IS NULL
    ORDER BY started_at DESC LIMIT 1;
  END IF;

  -- 4. Determine state
  IF v_attendance.clock_in_at IS NULL THEN
    v_state := 'not_started';
  ELSIF v_attendance.clock_out_at IS NOT NULL THEN
    v_state := 'done';
  ELSIF v_open_break_at IS NOT NULL THEN
    v_state := 'on_break';
  ELSE
    v_state := 'working';
  END IF;

  -- 5. Validate transition
  IF NOT (
    (v_state = 'not_started' AND p_punch_type = 'clock_in') OR
    (v_state = 'working'     AND p_punch_type IN ('clock_out', 'break_start')) OR
    (v_state = 'on_break'    AND p_punch_type = 'break_end')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_transition', 'state', v_state);
  END IF;

  -- 6. Apply mutation
  IF p_punch_type = 'clock_in' THEN
    IF v_attendance_id IS NULL THEN
      INSERT INTO attendance_records (
        tenant_id, workplace_id, employee_id, work_date, clock_in_at, status
      ) VALUES (
        v_employee.tenant_id, v_employee.workplace_id, v_employee.id,
        v_work_date, v_now, 'submitted'
      ) RETURNING id, clock_in_at, clock_out_at INTO v_attendance_id, v_attendance.clock_in_at, v_attendance.clock_out_at;
    ELSE
      UPDATE attendance_records SET clock_in_at = v_now, status = 'submitted'
      WHERE id = v_attendance_id
      RETURNING clock_in_at, clock_out_at INTO v_attendance.clock_in_at, v_attendance.clock_out_at;
    END IF;

  ELSIF p_punch_type = 'clock_out' THEN
    UPDATE attendance_records SET clock_out_at = v_now
    WHERE id = v_attendance_id
    RETURNING clock_in_at, clock_out_at INTO v_attendance.clock_in_at, v_attendance.clock_out_at;

  ELSIF p_punch_type = 'break_start' THEN
    INSERT INTO break_records (attendance_record_id, started_at)
    VALUES (v_attendance_id, v_now);
    v_open_break_at := v_now;

  ELSIF p_punch_type = 'break_end' THEN
    UPDATE break_records SET ended_at = v_now WHERE id = v_open_break_id;
    v_open_break_at := NULL;

    -- Recompute total break minutes for the day
    SELECT COALESCE(
      SUM(GREATEST(EXTRACT(EPOCH FROM (ended_at - started_at))/60, 0))::int,
      0
    )
    INTO v_total_break_min
    FROM break_records
    WHERE attendance_record_id = v_attendance_id AND ended_at IS NOT NULL;

    UPDATE attendance_records SET break_minutes = v_total_break_min
    WHERE id = v_attendance_id;
  END IF;

  -- 7. Audit log
  INSERT INTO audit_logs (
    tenant_id, actor_id, actor_role, action,
    resource_type, resource_id, metadata
  ) VALUES (
    v_employee.tenant_id, NULL, 'employee', p_punch_type,
    'attendance_record', v_attendance_id,
    jsonb_build_object(
      'client_ip',     p_client_ip,
      'user_agent',    p_user_agent,
      'punch_method',  p_punch_method
    )
  );

  -- 8. Return new snapshot for the client to update without re-fetching
  RETURN jsonb_build_object(
    'ok', true,
    'snapshot', jsonb_build_object(
      'clock_in_at',           v_attendance.clock_in_at,
      'clock_out_at',          v_attendance.clock_out_at,
      'open_break_started_at', v_open_break_at
    )
  );
END;
$$;
