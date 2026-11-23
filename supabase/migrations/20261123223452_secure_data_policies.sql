-- Policies for legacy tables plus stronger cross-record integrity and controlled workflows.

ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_authorisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_divisions_public_read ON school_divisions;
CREATE POLICY school_divisions_public_read ON school_divisions FOR SELECT TO anon USING (true);
GRANT SELECT ON school_divisions TO anon;

-- Division-level policies exclude technical administrators from pupil, finance, and medical data.
DROP POLICY IF EXISTS students_scoped_read ON students;
CREATE POLICY students_scoped_read ON students FOR SELECT TO authenticated
USING (upwa_can_access_student(id, current_division_id, current_class_id));
DROP POLICY IF EXISTS students_registry_insert ON students;
CREATE POLICY students_registry_insert ON students FOR INSERT TO authenticated
WITH CHECK (upwa_has_permission('registry.manage', current_division_id));
DROP POLICY IF EXISTS students_registry_update ON students;
CREATE POLICY students_registry_update ON students FOR UPDATE TO authenticated
USING (upwa_has_permission('registry.manage', current_division_id))
WITH CHECK (upwa_has_permission('registry.manage', current_division_id));

-- Explicit column grants keep the legacy plaintext medical column inaccessible.
REVOKE SELECT ON students FROM anon, authenticated;
GRANT SELECT (id, admission_number, first_name, last_name, middle_name, date_of_birth, gender,
  current_division_id, current_class_id, status, photo_storage_path, created_at)
ON students TO authenticated;

DROP POLICY IF EXISTS guardians_self_or_school_read ON guardians;
CREATE POLICY guardians_self_or_school_read ON guardians FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM student_guardians sg JOIN students s ON s.id = sg.student_id
    WHERE sg.guardian_id = guardians.id AND upwa_has_permission('registry.manage', s.current_division_id)
  )
);
DROP POLICY IF EXISTS guardians_registry_manage ON guardians;
CREATE POLICY guardians_registry_manage ON guardians FOR ALL TO authenticated
USING (upwa_has_permission('registry.manage')) WITH CHECK (upwa_has_permission('registry.manage'));
DROP POLICY IF EXISTS student_guardians_linked_read ON student_guardians;
CREATE POLICY student_guardians_linked_read ON student_guardians FOR SELECT TO authenticated USING (
  upwa_is_guardian_of(student_id) OR EXISTS (
    SELECT 1 FROM students s WHERE s.id = student_id
      AND upwa_has_permission('registry.manage', s.current_division_id)
  )
);
DROP POLICY IF EXISTS student_guardians_registry_manage ON student_guardians;
CREATE POLICY student_guardians_registry_manage ON student_guardians FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND upwa_has_permission('registry.manage', s.current_division_id)))
WITH CHECK (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND upwa_has_permission('registry.manage', s.current_division_id)));

DROP POLICY IF EXISTS legacy_scores_linked_read ON score_entries;
CREATE POLICY legacy_scores_linked_read ON score_entries FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM students s WHERE s.id = student_id
    AND upwa_can_access_student(s.id, s.current_division_id, s.current_class_id))
  AND (status = 'PUBLISHED' OR EXISTS (
    SELECT 1 FROM students s WHERE s.id = student_id
      AND upwa_has_permission('academics.read', s.current_division_id)
  ))
);
DROP POLICY IF EXISTS legacy_scores_class_insert ON score_entries;
CREATE POLICY legacy_scores_class_insert ON score_entries FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND upwa_can_manage_class(s.current_class_id))
  AND updated_by = auth.uid() AND status IN ('DRAFT','SUBMITTED')
);
DROP POLICY IF EXISTS legacy_scores_class_update ON score_entries;
CREATE POLICY legacy_scores_class_update ON score_entries FOR UPDATE TO authenticated USING (
  status IN ('DRAFT','SUBMITTED','REVIEWED') AND EXISTS (
    SELECT 1 FROM students s WHERE s.id = student_id AND upwa_can_manage_class(s.current_class_id)
  )
) WITH CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED') AND EXISTS (
  SELECT 1 FROM students s WHERE s.id = student_id AND upwa_can_manage_class(s.current_class_id)
));
DROP POLICY IF EXISTS legacy_scores_approve ON score_entries;
CREATE POLICY legacy_scores_approve ON score_entries FOR UPDATE TO authenticated USING (
  status IN ('SUBMITTED','REVIEWED','APPROVED') AND EXISTS (
    SELECT 1 FROM students s WHERE s.id = student_id AND upwa_has_permission('assessments.approve', s.current_division_id)
  )
) WITH CHECK (status IN ('APPROVED','PUBLISHED') AND EXISTS (
  SELECT 1 FROM students s WHERE s.id = student_id AND upwa_has_permission('assessments.approve', s.current_division_id)
));

DROP POLICY IF EXISTS invoices_bursar_or_parent_read ON invoices;
CREATE POLICY invoices_bursar_or_parent_read ON invoices FOR SELECT TO authenticated USING (
  upwa_has_permission('finance.read', division_id) OR upwa_is_guardian_of(student_id)
);
DROP POLICY IF EXISTS invoices_bursar_manage ON invoices;
CREATE POLICY invoices_bursar_manage ON invoices FOR INSERT TO authenticated WITH CHECK (
  upwa_has_permission('finance.manage', division_id)
);
DROP POLICY IF EXISTS invoices_bursar_update ON invoices;
CREATE POLICY invoices_bursar_update ON invoices FOR UPDATE TO authenticated USING (
  upwa_has_permission('finance.manage', division_id)
) WITH CHECK (upwa_has_permission('finance.manage', division_id));
DROP POLICY IF EXISTS receipts_bursar_or_parent_read ON receipts;
CREATE POLICY receipts_bursar_or_parent_read ON receipts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND
    (upwa_has_permission('finance.read', i.division_id) OR upwa_is_guardian_of(i.student_id)))
);
DROP POLICY IF EXISTS receipts_bursar_insert ON receipts;
CREATE POLICY receipts_bursar_insert ON receipts FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND upwa_has_permission('finance.manage', i.division_id))
);
DROP POLICY IF EXISTS ledger_finance_read ON ledger_entries;
CREATE POLICY ledger_finance_read ON ledger_entries FOR SELECT TO authenticated USING (
  upwa_has_permission('finance.read', division_id)
);
DROP POLICY IF EXISTS ledger_finance_insert ON ledger_entries;
CREATE POLICY ledger_finance_insert ON ledger_entries FOR INSERT TO authenticated WITH CHECK (
  upwa_has_permission('finance.manage', division_id) AND approved_by = auth.uid()
);

DROP POLICY IF EXISTS pickup_authorisations_read ON pickup_authorisations;
CREATE POLICY pickup_authorisations_read ON pickup_authorisations FOR SELECT TO authenticated USING (
  upwa_is_guardian_of(student_id) OR EXISTS (
    SELECT 1 FROM students s WHERE s.id = student_id AND upwa_has_permission('pickup.manage', s.current_division_id)
  )
);
DROP POLICY IF EXISTS pickup_authorisations_guardian_manage ON pickup_authorisations;
CREATE POLICY pickup_authorisations_guardian_manage ON pickup_authorisations FOR INSERT TO authenticated WITH CHECK (
  upwa_is_guardian_of(student_id)
);
DROP POLICY IF EXISTS pickup_events_read ON pickup_events;
CREATE POLICY pickup_events_read ON pickup_events FOR SELECT TO authenticated USING (
  upwa_is_guardian_of(student_id) OR EXISTS (
    SELECT 1 FROM students s WHERE s.id = student_id AND upwa_has_permission('pickup.manage', s.current_division_id)
  )
);
DROP POLICY IF EXISTS pickup_events_guard_manage ON pickup_events;
CREATE POLICY pickup_events_guard_manage ON pickup_events FOR INSERT TO authenticated WITH CHECK (
  released_by = auth.uid() AND EXISTS (
    SELECT 1 FROM students s WHERE s.id = student_id AND upwa_has_permission('pickup.manage', s.current_division_id)
  ) AND EXISTS (
    SELECT 1 FROM pickup_authorisations pa WHERE pa.id = authorisation_id AND pa.student_id = pickup_events.student_id
      AND pa.is_active AND (pa.expires_at IS NULL OR pa.expires_at > now())
  )
);

DROP POLICY IF EXISTS admission_cycles_public_open_read ON admission_cycles;
CREATE POLICY admission_cycles_public_open_read ON admission_cycles FOR SELECT TO anon, authenticated USING (
  status = 'OPEN' AND now() BETWEEN opens_at AND closes_at
);
DROP POLICY IF EXISTS admission_cycles_staff_manage ON admission_cycles;
CREATE POLICY admission_cycles_staff_manage ON admission_cycles FOR ALL TO authenticated
USING (upwa_has_permission('admissions.manage', division_id))
WITH CHECK (upwa_has_permission('admissions.manage', division_id));
DROP POLICY IF EXISTS admissions_public_apply ON admission_applications;
DROP POLICY IF EXISTS admission_applications_no_direct_public_insert ON admission_applications;
CREATE POLICY admission_applications_no_direct_public_insert ON admission_applications FOR INSERT TO authenticated
WITH CHECK (upwa_has_permission('admissions.manage', division_id));

DROP POLICY IF EXISTS assessment_scores_approval_update ON assessment_scores;
CREATE POLICY assessment_scores_approval_update ON assessment_scores FOR UPDATE TO authenticated
USING (status IN ('SUBMITTED','REVIEWED') AND upwa_has_permission('assessments.approve', division_id))
WITH CHECK (status IN ('APPROVED','PUBLISHED') AND upwa_has_permission('assessments.approve', division_id));
DROP POLICY IF EXISTS assessment_scores_teacher_update ON assessment_scores;
CREATE POLICY assessment_scores_teacher_update ON assessment_scores FOR UPDATE TO authenticated
USING (status IN ('DRAFT','SUBMITTED','REVIEWED') AND upwa_can_manage_class(class_id))
WITH CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED') AND upwa_can_manage_class(class_id));

DROP POLICY IF EXISTS report_verification_public_reference_read ON report_verification;
CREATE POLICY report_verification_public_reference_read ON report_verification FOR SELECT TO anon, authenticated USING (true);

-- Teachers/caregivers get only their assigned classes; a technical administrator gets no school data by default.
CREATE OR REPLACE FUNCTION upwa_validate_attendance()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_student students%ROWTYPE; v_class classes%ROWTYPE;
BEGIN
  SELECT * INTO v_student FROM students WHERE id = NEW.student_id;
  SELECT * INTO v_class FROM classes WHERE id = NEW.class_id;
  IF v_student.id IS NULL OR v_class.id IS NULL OR v_student.current_division_id <> NEW.division_id
     OR v_class.division_id <> NEW.division_id OR v_student.current_class_id <> NEW.class_id THEN
    RAISE EXCEPTION 'Attendance student, class, and division must match the current placement';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_upwa_validate_attendance ON attendance_records;
CREATE TRIGGER trg_upwa_validate_attendance BEFORE INSERT OR UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION upwa_validate_attendance();

CREATE OR REPLACE FUNCTION upwa_validate_assessment_score()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_component assessment_components%ROWTYPE; v_student students%ROWTYPE; v_class classes%ROWTYPE;
BEGIN
  SELECT * INTO v_component FROM assessment_components WHERE id = NEW.component_id;
  SELECT * INTO v_student FROM students WHERE id = NEW.student_id;
  SELECT * INTO v_class FROM classes WHERE id = NEW.class_id;
  IF v_component.id IS NULL OR v_student.id IS NULL OR v_class.id IS NULL
     OR v_component.division_id <> NEW.division_id OR v_student.current_division_id <> NEW.division_id
     OR v_class.division_id <> NEW.division_id OR v_student.current_class_id <> NEW.class_id THEN
    RAISE EXCEPTION 'Assessment student, class, component, and division must match';
  END IF;
  IF NEW.numeric_score IS NOT NULL AND (v_component.is_developmental OR NEW.numeric_score < 0 OR NEW.numeric_score > v_component.maximum_score) THEN
    RAISE EXCEPTION 'Numeric score is incompatible with the configured assessment component';
  END IF;
  IF NEW.developmental_level IS NOT NULL AND NOT v_component.is_developmental THEN
    RAISE EXCEPTION 'Developmental rating is not enabled for this component';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'PUBLISHED' AND
     (NEW.numeric_score IS DISTINCT FROM OLD.numeric_score OR NEW.developmental_level IS DISTINCT FROM OLD.developmental_level
      OR NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.component_id IS DISTINCT FROM OLD.component_id) THEN
    RAISE EXCEPTION 'Published assessments are immutable; use an audited correction workflow';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_upwa_validate_assessment_score ON assessment_scores;
CREATE TRIGGER trg_upwa_validate_assessment_score BEFORE INSERT OR UPDATE ON assessment_scores
FOR EACH ROW EXECUTE FUNCTION upwa_validate_assessment_score();

CREATE OR REPLACE FUNCTION upwa_validate_student_placement()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_class_division UUID;
BEGIN
  IF NEW.current_class_id IS NOT NULL THEN
    SELECT division_id INTO v_class_division FROM classes WHERE id = NEW.current_class_id;
    IF v_class_division IS DISTINCT FROM NEW.current_division_id THEN
      RAISE EXCEPTION 'Student class must belong to the selected division';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_upwa_validate_student_placement ON students;
CREATE TRIGGER trg_upwa_validate_student_placement BEFORE INSERT OR UPDATE OF current_class_id, current_division_id ON students
FOR EACH ROW EXECUTE FUNCTION upwa_validate_student_placement();

CREATE OR REPLACE FUNCTION upwa_application_for_upload(p_token TEXT)
RETURNS TABLE(application_id UUID, status TEXT)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT a.id, a.status
  FROM admission_applications a
  WHERE a.tracking_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND a.status IN ('SUBMITTED','UNDER_REVIEW','EXAM_SCHEDULED')
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION upwa_application_for_upload(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION upwa_record_admission_document(p_token TEXT, p_document_type TEXT, p_storage_path TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_application admission_applications%ROWTYPE; v_document_id UUID;
BEGIN
  SELECT * INTO v_application FROM admission_applications a
  WHERE a.tracking_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND a.status IN ('SUBMITTED','UNDER_REVIEW','EXAM_SCHEDULED')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application token is invalid or the upload window is closed'; END IF;
  IF p_document_type NOT IN ('PASSPORT','BIRTH_CERTIFICATE','PREVIOUS_REPORT','OTHER') THEN RAISE EXCEPTION 'Invalid document type'; END IF;
  IF p_storage_path NOT LIKE v_application.id::text || '/%' THEN RAISE EXCEPTION 'Invalid document path'; END IF;
  INSERT INTO admission_documents (application_id, document_type, storage_path)
  VALUES (v_application.id, p_document_type, p_storage_path)
  RETURNING id INTO v_document_id;
  RETURN v_document_id;
END;
$$;
GRANT EXECUTE ON FUNCTION upwa_record_admission_document(TEXT,TEXT,TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS admission_documents_private_object_read ON storage.objects;
CREATE POLICY admission_documents_private_object_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'upwa-admission-documents' AND EXISTS (
  SELECT 1 FROM admission_documents d
  JOIN admission_applications a ON a.id = d.application_id
  WHERE d.storage_path = storage.objects.name
    AND upwa_has_permission('admissions.manage', a.division_id)
));

CREATE OR REPLACE FUNCTION upwa_register_student(
  p_division_id UUID,
  p_class_id UUID,
  p_admission_number TEXT,
  p_first_name TEXT,
  p_middle_name TEXT,
  p_last_name TEXT,
  p_date_of_birth DATE,
  p_gender TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_student_id UUID;
  v_session_id UUID;
  v_class_division UUID;
BEGIN
  IF NOT upwa_has_permission('registry.manage', p_division_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF trim(p_admission_number) = '' OR trim(p_first_name) = '' OR trim(p_last_name) = '' THEN
    RAISE EXCEPTION 'Admission number and pupil name are required';
  END IF;
  IF p_date_of_birth IS NOT NULL AND p_date_of_birth > CURRENT_DATE THEN RAISE EXCEPTION 'Invalid date of birth'; END IF;
  IF p_class_id IS NOT NULL THEN
    SELECT division_id INTO v_class_division FROM classes WHERE id = p_class_id;
    IF v_class_division IS DISTINCT FROM p_division_id THEN RAISE EXCEPTION 'Class does not belong to this division'; END IF;
  END IF;
  SELECT session_id INTO v_session_id FROM division_academic_calendars
  WHERE division_id = p_division_id AND is_current = true LIMIT 1;
  IF v_session_id IS NULL THEN RAISE EXCEPTION 'Configure a current academic session for this division first'; END IF;

  INSERT INTO students (admission_number, first_name, middle_name, last_name, date_of_birth, gender,
    current_division_id, current_class_id, status)
  VALUES (trim(p_admission_number), trim(p_first_name), nullif(trim(p_middle_name), ''), trim(p_last_name),
    p_date_of_birth, p_gender, p_division_id, p_class_id, 'ACTIVE')
  RETURNING id INTO v_student_id;
  INSERT INTO student_enrolments (student_id, division_id, class_id, session_id, status, created_by)
  VALUES (v_student_id, p_division_id, p_class_id, v_session_id, 'ACTIVE', auth.uid());
  RETURN v_student_id;
END;
$$;
GRANT EXECUTE ON FUNCTION upwa_register_student(UUID,UUID,TEXT,TEXT,TEXT,TEXT,DATE,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_import_students(p_job_id UUID, p_division_id UUID, p_records JSONB)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_job data_import_jobs%ROWTYPE;
  v_session_id UUID;
  v_record JSONB;
  v_class_id UUID;
  v_inserted INTEGER := 0;
BEGIN
  IF NOT upwa_has_permission('registry.manage', p_division_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT * INTO v_job FROM data_import_jobs WHERE id = p_job_id AND division_id = p_division_id
    AND imported_by = auth.uid() AND entity_type = 'STUDENTS' AND status = 'PREVIEW' FOR UPDATE;
  IF NOT FOUND OR v_job.error_rows > 0 OR v_job.total_rows <> jsonb_array_length(p_records) THEN
    RAISE EXCEPTION 'The import preview is invalid, stale, or contains errors';
  END IF;
  SELECT session_id INTO v_session_id FROM division_academic_calendars
  WHERE division_id = p_division_id AND is_current = true LIMIT 1;
  IF v_session_id IS NULL THEN RAISE EXCEPTION 'Configure a current academic period before importing students'; END IF;

  FOR v_record IN SELECT value FROM jsonb_array_elements(p_records)
  LOOP
    SELECT id INTO v_class_id FROM classes
      WHERE division_id = p_division_id AND lower(name) = lower(trim(v_record->>'class_name'));
    IF v_class_id IS NULL THEN RAISE EXCEPTION 'A class in the preview no longer exists'; END IF;
    INSERT INTO students (admission_number, first_name, middle_name, last_name, date_of_birth,
      gender, current_division_id, current_class_id, status)
    VALUES (
      trim(v_record->>'admission_number'), trim(v_record->>'first_name'),
      nullif(trim(v_record->>'middle_name'), ''), trim(v_record->>'last_name'),
      nullif(v_record->>'date_of_birth', '')::DATE, nullif(v_record->>'gender', ''),
      p_division_id, v_class_id, 'ACTIVE'
    );
    INSERT INTO student_enrolments (student_id, division_id, class_id, session_id, status, created_by)
    SELECT id, p_division_id, v_class_id, v_session_id, 'ACTIVE', auth.uid()
    FROM students WHERE admission_number = trim(v_record->>'admission_number');
    v_inserted := v_inserted + 1;
  END LOOP;

  UPDATE data_import_jobs SET status = 'COMPLETED', inserted_rows = v_inserted, completed_at = now()
  WHERE id = v_job.id;
  RETURN v_inserted;
END;
$$;
GRANT EXECUTE ON FUNCTION upwa_import_students(UUID,UUID,JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_import_staff(p_job_id UUID, p_division_id UUID, p_records JSONB)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_job data_import_jobs%ROWTYPE;
  v_record JSONB;
  v_inserted INTEGER := 0;
  v_status TEXT;
BEGIN
  IF NOT upwa_has_permission('registry.manage', p_division_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT * INTO v_job FROM data_import_jobs WHERE id = p_job_id AND division_id = p_division_id
    AND imported_by = auth.uid() AND entity_type = 'STAFF' AND status = 'PREVIEW' FOR UPDATE;
  IF NOT FOUND OR v_job.error_rows > 0 OR v_job.total_rows <> jsonb_array_length(p_records) THEN
    RAISE EXCEPTION 'The import preview is invalid, stale, or contains errors';
  END IF;

  FOR v_record IN SELECT value FROM jsonb_array_elements(p_records)
  LOOP
    v_status := COALESCE(nullif(upper(trim(v_record->>'employment_status')), ''), 'ACTIVE');
    IF v_status NOT IN ('ACTIVE','ON_LEAVE','ENDED') THEN RAISE EXCEPTION 'Invalid staff employment status'; END IF;
    INSERT INTO staff_profiles (staff_number, full_name, division_id, position_title, employment_status, subjects)
    VALUES (trim(v_record->>'staff_number'), trim(v_record->>'full_name'), p_division_id,
      nullif(trim(v_record->>'position_title'), ''), v_status,
      CASE WHEN nullif(trim(v_record->>'subjects'), '') IS NULL THEN '{}'::TEXT[]
           ELSE string_to_array(v_record->>'subjects', ';') END);
    v_inserted := v_inserted + 1;
  END LOOP;

  UPDATE data_import_jobs SET status = 'COMPLETED', inserted_rows = v_inserted, completed_at = now()
  WHERE id = v_job.id;
  RETURN v_inserted;
END;
$$;
GRANT EXECUTE ON FUNCTION upwa_import_staff(UUID,UUID,JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_enroll_admission(p_application_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_application admission_applications%ROWTYPE;
  v_student_id UUID;
  v_guardian_id UUID;
  v_prefix TEXT;
BEGIN
  SELECT * INTO v_application FROM admission_applications
  WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF NOT upwa_has_permission('admissions.manage', v_application.division_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF v_application.enrolled_student_id IS NOT NULL THEN
    RETURN v_application.enrolled_student_id;
  END IF;
  IF v_application.status <> 'ACCEPTED' THEN
    RAISE EXCEPTION 'Only accepted applications can be enrolled';
  END IF;

  v_prefix := CASE WHEN v_application.division_id = (SELECT id FROM school_divisions WHERE code = 'PRIMARY_EARLY_YEARS') THEN 'PRI' ELSE 'SEC' END;
  v_student_id := gen_random_uuid();
  INSERT INTO students (id, admission_number, first_name, middle_name, last_name, date_of_birth,
    gender, current_division_id, current_class_id, status)
  VALUES (v_student_id, 'UPWA/' || v_prefix || '/' || upper(substr(replace(v_student_id::text, '-', ''), 1, 10)),
    v_application.applicant_first_name, v_application.applicant_middle_name, v_application.applicant_last_name,
    v_application.date_of_birth, v_application.gender, v_application.division_id,
    v_application.target_class_id, 'ACTIVE');

  INSERT INTO student_enrolments (student_id, division_id, class_id, session_id, status, created_by)
  VALUES (v_student_id, v_application.division_id, v_application.target_class_id, v_application.session_id, 'ACTIVE', auth.uid());

  INSERT INTO guardians (full_name, email, phone)
  VALUES (v_application.guardian_name, v_application.guardian_email, v_application.guardian_phone)
  RETURNING id INTO v_guardian_id;
  INSERT INTO student_guardians (student_id, guardian_id, relationship, is_primary_payer, can_authorize_pickup)
  VALUES (v_student_id, v_guardian_id, 'PARENT_GUARDIAN', true, false);

  UPDATE admission_applications SET status = 'ENROLLED', enrolled_student_id = v_student_id,
    updated_at = now() WHERE id = v_application.id;
  RETURN v_student_id;
END;
$$;
GRANT EXECUTE ON FUNCTION upwa_enroll_admission(UUID) TO authenticated;

-- Only the secure RPC may create a public application or expose its one-time tracking secret.
REVOKE INSERT, SELECT ON admission_applications FROM anon;
REVOKE INSERT ON admission_applications FROM authenticated;
REVOKE SELECT ON admission_cycles FROM anon;
GRANT EXECUTE ON FUNCTION upwa_public_admission_options() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upwa_submit_application(UUID,TEXT,TEXT,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;

-- Fine-grained grants for legacy tables protected above by RLS.
GRANT SELECT ON students, guardians, student_guardians, score_entries, invoices, receipts,
  ledger_entries, pickup_authorisations, pickup_events, admission_cycles TO authenticated;
GRANT INSERT, UPDATE ON students, guardians, student_guardians, invoices, receipts, pickup_authorisations TO authenticated;
GRANT INSERT ON score_entries, ledger_entries, pickup_events TO authenticated;
GRANT UPDATE ON score_entries, invoices TO authenticated;
GRANT SELECT (id, document_reference, version, status, issued_at) ON report_verification TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON admission_applications, admission_history TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON audit_logs, admission_history FROM anon, authenticated;
