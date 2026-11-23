-- UPWA-ISMS operational foundation: multi-division RBAC, admissions, registry,
-- attendance, assessments, timetable, CMS, and audit history.
-- All access is scoped by auth.uid() and database RLS. No demo people or results.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Establish only the divisions supplied in the approved school brief. Calendar dates,
-- staffing, fees, achievements, and all personal records are intentionally not invented.
INSERT INTO institutions (name, short_name)
SELECT 'UPWA International Schools', 'UPWA-ISMS'
WHERE NOT EXISTS (SELECT 1 FROM institutions WHERE name = 'UPWA International Schools');

INSERT INTO school_divisions (institution_id, code, name)
SELECT i.id, d.code, d.name
FROM institutions i
CROSS JOIN (VALUES
  ('PRIMARY_EARLY_YEARS', 'Primary / Early Years'),
  ('SECONDARY', 'Secondary')
) AS d(code, name)
WHERE i.name = 'UPWA International Schools'
ON CONFLICT (code) DO NOTHING;

INSERT INTO school_sections (division_id, name)
SELECT d.id, section.name
FROM school_divisions d
CROSS JOIN (VALUES ('Crèche'), ('Nursery'), ('Primary'), ('Junior Secondary'), ('Senior Secondary')) AS section(name)
WHERE (d.code = 'PRIMARY_EARLY_YEARS' AND section.name IN ('Crèche','Nursery','Primary'))
   OR (d.code = 'SECONDARY' AND section.name IN ('Junior Secondary','Senior Secondary'))
ON CONFLICT (division_id, name) DO NOTHING;

INSERT INTO classes (division_id, section_id, name, sort_order)
SELECT d.id, sec.id, levels.name, levels.sort_order
FROM school_divisions d
JOIN (VALUES
  ('PRIMARY_EARLY_YEARS','Crèche','Crèche',1),
  ('PRIMARY_EARLY_YEARS','Nursery','Nursery',2),
  ('PRIMARY_EARLY_YEARS','Primary','Primary 1',3),
  ('PRIMARY_EARLY_YEARS','Primary','Primary 2',4),
  ('PRIMARY_EARLY_YEARS','Primary','Primary 3',5),
  ('PRIMARY_EARLY_YEARS','Primary','Primary 4',6),
  ('PRIMARY_EARLY_YEARS','Primary','Primary 5',7),
  ('PRIMARY_EARLY_YEARS','Primary','Primary 6',8),
  ('SECONDARY','Junior Secondary','JSS 1',1),
  ('SECONDARY','Junior Secondary','JSS 2',2),
  ('SECONDARY','Junior Secondary','JSS 3',3),
  ('SECONDARY','Senior Secondary','SSS 1',4),
  ('SECONDARY','Senior Secondary','SSS 2',5),
  ('SECONDARY','Senior Secondary','SSS 3',6)
) AS levels(division_code, section_name, name, sort_order) ON levels.division_code = d.code
JOIN school_sections sec ON sec.division_id = d.id AND sec.name = levels.section_name
ON CONFLICT (division_id, name) DO NOTHING;

-- Authenticated identities are kept separate from school-specific personnel records.
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

INSERT INTO roles (code, label) VALUES
  ('TECH_SUPER_ADMIN', 'Technical Super Administrator'),
  ('UPWA_PRESIDENT', 'UPWA President'),
  ('EXECUTIVE_BOARD', 'UPWA Executive Board'),
  ('PRIMARY_HEAD_TEACHER', 'Primary Head Teacher'),
  ('SECONDARY_PRINCIPAL', 'Secondary Principal'),
  ('BURSAR_ACCOUNTANT', 'Bursar / Accountant'),
  ('EXAMINATIONS_OFFICER', 'Examinations Officer'),
  ('TEACHER', 'Teacher'),
  ('ADMISSIONS_OFFICER', 'Admissions Officer'),
  ('PARENT_GUARDIAN', 'Parent / Guardian'),
  ('STUDENT', 'Student'),
  ('CRECHE_CAREGIVER', 'Crèche Caregiver'),
  ('GATE_SECURITY', 'Gate / Security Officer'),
  ('CONTENT_EDITOR', 'Website Content Editor'),
  ('SCHOOL_NURSE', 'School Nurse')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, description) VALUES
  ('platform.configure', 'Manage platform configuration and integrations'),
  ('users.manage', 'Manage user accounts and role assignments'),
  ('audit.read', 'Read technical audit event metadata'),
  ('executive.read', 'Read consolidated, non-sensitive school dashboards'),
  ('finance.read', 'Read authorised financial reports'),
  ('finance.manage', 'Manage invoices, receipts, expenses, and reconciliation'),
  ('academics.read', 'Read academic records in an assigned division'),
  ('academics.manage', 'Manage assigned classes, assessment, and attendance'),
  ('assessments.approve', 'Review and approve assessment publication'),
  ('admissions.manage', 'Review and manage admissions for an assigned division'),
  ('registry.manage', 'Manage student and staff registry records'),
  ('pickup.manage', 'Verify authorised pickup and record pupil release'),
  ('care.manage', 'Manage assigned early-years care and safety logs'),
  ('cms.manage', 'Create and publish approved public website content'),
  ('parent.read', 'Read records for linked children only'),
  ('student.read', 'Read own learning information and published results')
ON CONFLICT (code) DO NOTHING;

-- Defaults are deliberately least-privilege; grants can be tailored per account.
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
JOIN permissions p ON p.code = ANY (CASE r.code
  WHEN 'TECH_SUPER_ADMIN' THEN ARRAY['platform.configure','users.manage','audit.read']::TEXT[]
  WHEN 'UPWA_PRESIDENT' THEN ARRAY['executive.read','finance.read','assessments.approve']::TEXT[]
  WHEN 'EXECUTIVE_BOARD' THEN ARRAY['executive.read','finance.read']::TEXT[]
  WHEN 'PRIMARY_HEAD_TEACHER' THEN ARRAY['academics.read','academics.manage','assessments.approve','admissions.manage','registry.manage','care.manage']::TEXT[]
  WHEN 'SECONDARY_PRINCIPAL' THEN ARRAY['academics.read','academics.manage','assessments.approve','admissions.manage','registry.manage']::TEXT[]
  WHEN 'BURSAR_ACCOUNTANT' THEN ARRAY['finance.read','finance.manage']::TEXT[]
  WHEN 'EXAMINATIONS_OFFICER' THEN ARRAY['academics.read','academics.manage','assessments.approve']::TEXT[]
  WHEN 'TEACHER' THEN ARRAY['academics.read','academics.manage']::TEXT[]
  WHEN 'ADMISSIONS_OFFICER' THEN ARRAY['admissions.manage']::TEXT[]
  WHEN 'PARENT_GUARDIAN' THEN ARRAY['parent.read']::TEXT[]
  WHEN 'STUDENT' THEN ARRAY['student.read']::TEXT[]
  WHEN 'CRECHE_CAREGIVER' THEN ARRAY['care.manage']::TEXT[]
  WHEN 'GATE_SECURITY' THEN ARRAY['pickup.manage']::TEXT[]
  WHEN 'CONTENT_EDITOR' THEN ARRAY['cms.manage']::TEXT[]
  WHEN 'SCHOOL_NURSE' THEN ARRAY['care.manage']::TEXT[]
  ELSE ARRAY[]::TEXT[]
END)
ON CONFLICT DO NOTHING;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION upwa_has_role(p_roles TEXT[], p_division_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.code = ANY (p_roles)
      AND (
        (p_division_id IS NULL AND ur.division_id IS NULL)
        OR (p_division_id IS NOT NULL AND (ur.division_id = p_division_id OR
          (ur.division_id IS NULL AND r.code IN ('UPWA_PRESIDENT', 'EXECUTIVE_BOARD'))))
      )
  );
$$;

CREATE OR REPLACE FUNCTION upwa_has_permission(p_permission TEXT, p_division_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    JOIN role_permissions rp ON rp.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND rp.permission_code = p_permission
      AND (
        (p_division_id IS NULL AND ur.division_id IS NULL)
        OR (p_division_id IS NOT NULL AND (ur.division_id = p_division_id OR
          (ur.division_id IS NULL AND r.code IN ('UPWA_PRESIDENT', 'EXECUTIVE_BOARD'))))
      )
  );
$$;

CREATE OR REPLACE FUNCTION upwa_is_guardian_of(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM student_guardians sg
    JOIN guardians g ON g.id = sg.guardian_id
    WHERE sg.student_id = p_student_id AND g.user_id = auth.uid()
  );
$$;

CREATE TABLE IF NOT EXISTS student_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_enrolments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  class_id UUID REFERENCES classes(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  enrolled_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ended_on DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PROMOTED','TRANSFERRED','WITHDRAWN','GRADUATED')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ended_on IS NULL OR ended_on >= enrolled_on)
);
CREATE INDEX IF NOT EXISTS student_enrolments_student_history_idx ON student_enrolments(student_id, enrolled_on DESC);

CREATE TABLE IF NOT EXISTS data_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('STUDENTS','STAFF')),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  imported_by UUID NOT NULL REFERENCES auth.users(id),
  source_filename TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PREVIEW' CHECK (status IN ('PREVIEW','COMPLETED','FAILED')),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS data_import_jobs_division_idx ON data_import_jobs(division_id, created_at DESC);

CREATE TABLE IF NOT EXISTS staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  position_title TEXT,
  employment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (employment_status IN ('ACTIVE','ON_LEAVE','ENDED')),
  subjects TEXT[] NOT NULL DEFAULT '{}',
  started_on DATE,
  ended_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_arms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (class_id, name)
);

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (division_id, code),
  UNIQUE (division_id, name)
);

CREATE TABLE IF NOT EXISTS staff_class_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  assignment_role TEXT NOT NULL DEFAULT 'SUBJECT_TEACHER' CHECK (assignment_role IN ('CLASS_TEACHER','SUBJECT_TEACHER','SUPPORT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_profile_id, class_id, subject_id, session_id, assignment_role)
);

CREATE OR REPLACE FUNCTION upwa_can_manage_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM classes c
    WHERE c.id = p_class_id
      AND (
        upwa_has_permission('academics.manage', c.division_id)
        AND upwa_has_role(ARRAY['PRIMARY_HEAD_TEACHER','SECONDARY_PRINCIPAL','EXAMINATIONS_OFFICER'], c.division_id)
        OR EXISTS (
          SELECT 1 FROM staff_class_assignments sca
          JOIN staff_profiles sp ON sp.id = sca.staff_profile_id
          JOIN user_roles ur ON ur.user_id = sp.user_id AND ur.division_id = c.division_id
          JOIN roles r ON r.id = ur.role_id AND r.code IN ('TEACHER','CRECHE_CAREGIVER')
          WHERE sca.class_id = c.id AND sp.user_id = auth.uid() AND sp.employment_status = 'ACTIVE'
        )
      )
  );
$$;

CREATE TABLE IF NOT EXISTS division_academic_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id),
  term_id UUID NOT NULL REFERENCES terms(id),
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (division_id, session_id, term_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS division_one_current_term_idx ON division_academic_calendars(division_id) WHERE is_current;

CREATE TABLE IF NOT EXISTS academic_division_settings (
  division_id UUID PRIMARY KEY REFERENCES school_divisions(id) ON DELETE CASCADE,
  grading_model TEXT NOT NULL CHECK (grading_model IN ('DEVELOPMENTAL','NUMERIC_COMPONENTS','MIXED')),
  attendance_parent_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  absence_notification_delay_minutes INTEGER NOT NULL DEFAULT 30 CHECK (absence_notification_delay_minutes BETWEEN 0 AND 1440),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  maximum_score NUMERIC(7,2) NOT NULL CHECK (maximum_score > 0),
  is_developmental BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (division_id, code)
);

CREATE TABLE IF NOT EXISTS assessment_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  subject_id UUID REFERENCES subjects(id),
  component_id UUID NOT NULL REFERENCES assessment_components(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  term_id UUID NOT NULL REFERENCES terms(id),
  numeric_score NUMERIC(7,2),
  developmental_level TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','PUBLISHED')),
  entered_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, component_id, session_id, term_id),
  CHECK ((numeric_score IS NULL) <> (developmental_level IS NULL) OR numeric_score IS NULL)
);
CREATE INDEX IF NOT EXISTS assessment_scores_class_idx ON assessment_scores(class_id, session_id, term_id, status);

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('PRESENT','ABSENT','LATE','EXCUSED')),
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, session_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS attendance_division_day_idx ON attendance_records(division_id, attendance_date, status);

CREATE TABLE IF NOT EXISTS timetable_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  subject_id UUID REFERENCES subjects(id),
  staff_profile_id UUID REFERENCES staff_profiles(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  room TEXT,
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS timetable_class_period_idx ON timetable_periods(class_id, session_id, day_of_week, starts_at);

CREATE TABLE IF NOT EXISTS admission_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  application_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (application_fee_amount >= 0),
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','OPEN','CLOSED','ARCHIVED')),
  entrance_exam_at TIMESTAMPTZ,
  exam_venue TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (closes_at > opens_at),
  UNIQUE (division_id, class_id, session_id)
);

CREATE TABLE IF NOT EXISTS admission_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES admission_cycles(id),
  enrolled_student_id UUID REFERENCES students(id),
  application_number TEXT NOT NULL UNIQUE DEFAULT ('UPWA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  target_class_id UUID NOT NULL REFERENCES classes(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  applicant_first_name TEXT NOT NULL,
  applicant_middle_name TEXT,
  applicant_last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK (gender IS NULL OR gender IN ('FEMALE','MALE','UNSPECIFIED')),
  guardian_name TEXT NOT NULL,
  guardian_email TEXT,
  guardian_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','UNDER_REVIEW','EXAM_SCHEDULED','OFFERED','WAITLISTED','ACCEPTED','REJECTED','ENROLLED','WITHDRAWN')),
  application_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (application_fee_amount >= 0),
  fee_invoice_id UUID REFERENCES invoices(id),
  exam_at TIMESTAMPTZ,
  exam_venue TEXT,
  decision_note TEXT,
  tracking_token_hash TEXT UNIQUE,
  duplicate_hash TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admission_division_status_idx ON admission_applications(division_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS admission_duplicate_candidate_idx ON admission_applications(division_id, date_of_birth, lower(guardian_phone), created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS admission_duplicate_guard_idx
  ON admission_applications(cycle_id, duplicate_hash) WHERE duplicate_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS admission_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES admission_applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('PASSPORT','BIRTH_CERTIFICATE','PREVIOUS_REPORT','OTHER')),
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, document_type, storage_path)
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('upwa-admission-documents', 'upwa-admission-documents', false, 10485760,
  ARRAY['image/jpeg','image/png','application/pdf']::TEXT[])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS admission_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES admission_applications(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION upwa_public_admission_options()
RETURNS TABLE(cycle_id UUID, division_code TEXT, division_name TEXT, class_id UUID, class_name TEXT, session_name TEXT, application_fee_amount NUMERIC, closes_at TIMESTAMPTZ, entrance_exam_at TIMESTAMPTZ, exam_venue TEXT)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT ac.id, d.code, d.name, c.id, c.name, s.name, ac.application_fee_amount,
         ac.closes_at, ac.entrance_exam_at, ac.exam_venue
  FROM admission_cycles ac
  JOIN school_divisions d ON d.id = ac.division_id
  JOIN classes c ON c.id = ac.class_id AND c.division_id = ac.division_id
  JOIN sessions s ON s.id = ac.session_id
  WHERE ac.status = 'OPEN' AND now() BETWEEN ac.opens_at AND ac.closes_at
  ORDER BY d.name, c.sort_order, c.name;
$$;

CREATE OR REPLACE FUNCTION upwa_submit_application(
  p_cycle_id UUID,
  p_first_name TEXT,
  p_middle_name TEXT,
  p_last_name TEXT,
  p_date_of_birth DATE,
  p_gender TEXT,
  p_guardian_name TEXT,
  p_guardian_email TEXT,
  p_guardian_phone TEXT,
  p_tracking_token TEXT
)
RETURNS TABLE(application_number TEXT, status TEXT, application_fee_amount NUMERIC, closes_at TIMESTAMPTZ, entrance_exam_at TIMESTAMPTZ, exam_venue TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_cycle admission_cycles%ROWTYPE;
  v_application_number TEXT;
  v_duplicate_hash TEXT;
BEGIN
  IF length(trim(p_first_name)) = 0 OR length(trim(p_last_name)) = 0
     OR length(trim(p_guardian_name)) = 0 OR length(trim(p_guardian_phone)) < 7
     OR p_date_of_birth > CURRENT_DATE OR length(p_tracking_token) < 32 THEN
    RAISE EXCEPTION 'Invalid application details';
  END IF;
  SELECT * INTO v_cycle FROM admission_cycles ac
  WHERE ac.id = p_cycle_id AND ac.status = 'OPEN'
    AND now() BETWEEN ac.opens_at AND ac.closes_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'This application round is not open'; END IF;
  IF p_gender IS NOT NULL AND p_gender NOT IN ('FEMALE','MALE','UNSPECIFIED') THEN
    RAISE EXCEPTION 'Invalid gender value';
  END IF;

  v_duplicate_hash := encode(extensions.digest(
    v_cycle.id::text || '|' || lower(trim(p_first_name)) || '|' || lower(trim(p_last_name)) || '|' ||
    p_date_of_birth::text || '|' || regexp_replace(p_guardian_phone, '[^0-9]', '', 'g'),
    'sha256'), 'hex');

  INSERT INTO admission_applications (
    cycle_id, division_id, target_class_id, session_id, applicant_first_name,
    applicant_middle_name, applicant_last_name, date_of_birth, gender, guardian_name,
    guardian_email, guardian_phone, application_fee_amount, exam_at, exam_venue,
    tracking_token_hash, duplicate_hash
  ) VALUES (
    v_cycle.id, v_cycle.division_id, v_cycle.class_id, v_cycle.session_id,
    trim(p_first_name), nullif(trim(p_middle_name), ''), trim(p_last_name), p_date_of_birth,
    p_gender, trim(p_guardian_name), nullif(lower(trim(p_guardian_email)), ''),
    trim(p_guardian_phone), v_cycle.application_fee_amount, v_cycle.entrance_exam_at,
    v_cycle.exam_venue, encode(extensions.digest(p_tracking_token, 'sha256'), 'hex'), v_duplicate_hash
  ) RETURNING admission_applications.application_number INTO v_application_number;

  RETURN QUERY SELECT v_application_number, 'SUBMITTED'::TEXT, v_cycle.application_fee_amount,
    v_cycle.closes_at, v_cycle.entrance_exam_at, v_cycle.exam_venue;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'A possible duplicate application already exists for this applicant and round';
END;
$$;

CREATE TABLE IF NOT EXISTS cms_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('PAGE','NEWS','EVENT','GALLERY','CAMPUS_TOUR','FACILITY','ACADEMIC_OFFERING','ACHIEVEMENT','LEADERSHIP_NOTE','CALENDAR')),
  division_id UUID REFERENCES school_divisions(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  media_paths TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_REVIEW','PUBLISHED','ARCHIVED')),
  seo_title TEXT,
  seo_description TEXT,
  is_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (division_id, slug)
);
CREATE INDEX IF NOT EXISTS cms_publication_idx ON cms_entries(content_type, division_id, published_at DESC) WHERE status = 'PUBLISHED';

CREATE TABLE IF NOT EXISTS cms_site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_care_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  log_type TEXT NOT NULL CHECK (log_type IN ('DAILY_CARE','SAFETY','MEAL','HEALTH_CHECK')),
  summary TEXT NOT NULL CHECK (length(summary) <= 2000),
  guardian_visible BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_care_student_date_idx ON daily_care_logs(student_id, log_date DESC);

CREATE TABLE IF NOT EXISTS student_medical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  alert_text TEXT NOT NULL,
  restricted_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The legacy free-text field is not exposed through API/RLS. New medical data belongs in the restricted table.
ALTER TABLE students ALTER COLUMN medical_alerts_encrypted SET DEFAULT NULL;

CREATE OR REPLACE FUNCTION upwa_can_access_student(p_student_id UUID, p_division_id UUID, p_class_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    upwa_has_role(ARRAY['UPWA_PRESIDENT','EXECUTIVE_BOARD','PRIMARY_HEAD_TEACHER','SECONDARY_PRINCIPAL','BURSAR_ACCOUNTANT','EXAMINATIONS_OFFICER','ADMISSIONS_OFFICER'], p_division_id)
    OR (
      p_class_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM staff_class_assignments a
        JOIN staff_profiles sp ON sp.id = a.staff_profile_id
        JOIN user_roles ur ON ur.user_id = sp.user_id AND ur.division_id = p_division_id
        JOIN roles r ON r.id = ur.role_id AND r.code IN ('TEACHER','CRECHE_CAREGIVER')
        WHERE a.class_id = p_class_id AND sp.user_id = auth.uid() AND sp.employment_status = 'ACTIVE'
      )
    )
    OR upwa_is_guardian_of(p_student_id)
    OR EXISTS (SELECT 1 FROM student_accounts sa WHERE sa.student_id = p_student_id AND sa.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION upwa_audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id TEXT;
BEGIN
  v_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id');
  INSERT INTO audit_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME, v_id,
          jsonb_build_object('source', 'database_trigger'));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION upwa_audit_admission_status()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO admission_history (application_id, from_status, to_status, note, actor_id)
    VALUES (NEW.id, CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END, NEW.status, NEW.decision_note, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_upwa_admission_status ON admission_applications;
CREATE TRIGGER trg_upwa_admission_status
AFTER INSERT OR UPDATE ON admission_applications
FOR EACH ROW EXECUTE FUNCTION upwa_audit_admission_status();

DROP TRIGGER IF EXISTS trg_upwa_student_audit ON students;
CREATE TRIGGER trg_upwa_student_audit AFTER INSERT OR UPDATE OR DELETE ON students
FOR EACH ROW EXECUTE FUNCTION upwa_audit_row_change();
DROP TRIGGER IF EXISTS trg_upwa_score_audit ON assessment_scores;
CREATE TRIGGER trg_upwa_score_audit AFTER INSERT OR UPDATE OR DELETE ON assessment_scores
FOR EACH ROW EXECUTE FUNCTION upwa_audit_row_change();
DROP TRIGGER IF EXISTS trg_upwa_attendance_audit ON attendance_records;
CREATE TRIGGER trg_upwa_attendance_audit AFTER INSERT OR UPDATE OR DELETE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION upwa_audit_row_change();
DROP TRIGGER IF EXISTS trg_upwa_admission_audit ON admission_applications;
CREATE TRIGGER trg_upwa_admission_audit AFTER INSERT OR UPDATE OR DELETE ON admission_applications
FOR EACH ROW EXECUTE FUNCTION upwa_audit_row_change();

-- Row Level Security: account identity and role assignments are self-readable;
-- role grants are writable only by technical administrators.
DROP POLICY IF EXISTS user_profiles_self_read ON user_profiles;
CREATE POLICY user_profiles_self_read ON user_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_profiles_self_update ON user_profiles;
CREATE POLICY user_profiles_self_update ON user_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS user_profiles_admin_manage ON user_profiles;
CREATE POLICY user_profiles_admin_manage ON user_profiles FOR ALL TO authenticated USING (upwa_has_role(ARRAY['TECH_SUPER_ADMIN'])) WITH CHECK (upwa_has_role(ARRAY['TECH_SUPER_ADMIN']));

DROP POLICY IF EXISTS roles_authenticated_read ON roles;
CREATE POLICY roles_authenticated_read ON roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS permissions_authenticated_read ON permissions;
CREATE POLICY permissions_authenticated_read ON permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS role_permissions_authenticated_read ON role_permissions;
CREATE POLICY role_permissions_authenticated_read ON role_permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS role_permissions_admin_manage ON role_permissions;
CREATE POLICY role_permissions_admin_manage ON role_permissions FOR ALL TO authenticated USING (upwa_has_role(ARRAY['TECH_SUPER_ADMIN'])) WITH CHECK (upwa_has_role(ARRAY['TECH_SUPER_ADMIN']));

DROP POLICY IF EXISTS user_roles_self_read ON user_roles;
CREATE POLICY user_roles_self_read ON user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_roles_admin_manage ON user_roles;
CREATE POLICY user_roles_admin_manage ON user_roles FOR ALL TO authenticated USING (upwa_has_role(ARRAY['TECH_SUPER_ADMIN'])) WITH CHECK (upwa_has_role(ARRAY['TECH_SUPER_ADMIN']));

-- School divisions and curriculum configuration are visible only to signed-in school users.
ALTER TABLE school_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_arms ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_division_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_academic_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_care_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_medical_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_divisions_signed_in_read ON school_divisions;
CREATE POLICY school_divisions_signed_in_read ON school_divisions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS school_sections_signed_in_read ON school_sections;
CREATE POLICY school_sections_signed_in_read ON school_sections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS classes_division_read ON classes;
CREATE POLICY classes_division_read ON classes FOR SELECT TO authenticated USING (upwa_has_permission('academics.read', division_id) OR upwa_has_permission('admissions.manage', division_id));
DROP POLICY IF EXISTS classes_admin_manage ON classes;
CREATE POLICY classes_admin_manage ON classes FOR ALL TO authenticated USING (upwa_has_permission('registry.manage', division_id)) WITH CHECK (upwa_has_permission('registry.manage', division_id));
DROP POLICY IF EXISTS class_arms_read ON class_arms;
CREATE POLICY class_arms_read ON class_arms FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND (upwa_has_permission('academics.read', c.division_id) OR upwa_has_permission('admissions.manage', c.division_id))));
DROP POLICY IF EXISTS subjects_division_read ON subjects;
CREATE POLICY subjects_division_read ON subjects FOR SELECT TO authenticated USING (upwa_has_permission('academics.read', division_id));
DROP POLICY IF EXISTS subjects_admin_manage ON subjects;
CREATE POLICY subjects_admin_manage ON subjects FOR ALL TO authenticated USING (upwa_has_permission('registry.manage', division_id)) WITH CHECK (upwa_has_permission('registry.manage', division_id));

DROP POLICY IF EXISTS data_import_jobs_scoped_read ON data_import_jobs;
CREATE POLICY data_import_jobs_scoped_read ON data_import_jobs FOR SELECT TO authenticated
USING (imported_by = auth.uid() OR upwa_has_permission('registry.manage', division_id));
DROP POLICY IF EXISTS data_import_jobs_create ON data_import_jobs;
CREATE POLICY data_import_jobs_create ON data_import_jobs FOR INSERT TO authenticated
WITH CHECK (imported_by = auth.uid() AND upwa_has_permission('registry.manage', division_id));
DROP POLICY IF EXISTS data_import_jobs_update ON data_import_jobs;
CREATE POLICY data_import_jobs_update ON data_import_jobs FOR UPDATE TO authenticated
USING (imported_by = auth.uid() AND upwa_has_permission('registry.manage', division_id))
WITH CHECK (imported_by = auth.uid() AND upwa_has_permission('registry.manage', division_id));

DROP POLICY IF EXISTS staff_profiles_scoped_read ON staff_profiles;
CREATE POLICY staff_profiles_scoped_read ON staff_profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR upwa_has_permission('registry.manage', division_id) OR upwa_has_role(ARRAY['UPWA_PRESIDENT','EXECUTIVE_BOARD'], division_id));
DROP POLICY IF EXISTS staff_profiles_admin_manage ON staff_profiles;
CREATE POLICY staff_profiles_admin_manage ON staff_profiles FOR ALL TO authenticated USING (upwa_has_permission('registry.manage', division_id)) WITH CHECK (upwa_has_permission('registry.manage', division_id));
DROP POLICY IF EXISTS staff_assignment_self_read ON staff_class_assignments;
CREATE POLICY staff_assignment_self_read ON staff_class_assignments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = staff_profile_id AND sp.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND upwa_has_permission('registry.manage', c.division_id)));
DROP POLICY IF EXISTS staff_assignment_admin_manage ON staff_class_assignments;
CREATE POLICY staff_assignment_admin_manage ON staff_class_assignments FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND upwa_has_permission('registry.manage', c.division_id))) WITH CHECK (EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND upwa_has_permission('registry.manage', c.division_id)));

DROP POLICY IF EXISTS student_accounts_self_read ON student_accounts;
CREATE POLICY student_accounts_self_read ON student_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS student_enrolments_scoped_read ON student_enrolments;
CREATE POLICY student_enrolments_scoped_read ON student_enrolments FOR SELECT TO authenticated USING (upwa_can_access_student(student_id, division_id, class_id));
DROP POLICY IF EXISTS student_enrolments_manage ON student_enrolments;
CREATE POLICY student_enrolments_manage ON student_enrolments FOR ALL TO authenticated USING (upwa_has_permission('registry.manage', division_id)) WITH CHECK (upwa_has_permission('registry.manage', division_id));

DROP POLICY IF EXISTS division_academic_calendar_read ON division_academic_calendars;
CREATE POLICY division_academic_calendar_read ON division_academic_calendars FOR SELECT TO authenticated
USING (upwa_has_permission('academics.read', division_id) OR upwa_has_permission('admissions.manage', division_id) OR upwa_has_permission('registry.manage', division_id));
DROP POLICY IF EXISTS division_academic_calendar_manage ON division_academic_calendars;
CREATE POLICY division_academic_calendar_manage ON division_academic_calendars FOR ALL TO authenticated
USING (upwa_has_permission('registry.manage', division_id)) WITH CHECK (upwa_has_permission('registry.manage', division_id));

DROP POLICY IF EXISTS academic_settings_read ON academic_division_settings;
CREATE POLICY academic_settings_read ON academic_division_settings FOR SELECT TO authenticated USING (upwa_has_permission('academics.read', division_id));
DROP POLICY IF EXISTS academic_settings_manage ON academic_division_settings;
CREATE POLICY academic_settings_manage ON academic_division_settings FOR ALL TO authenticated USING (upwa_has_permission('registry.manage', division_id)) WITH CHECK (upwa_has_permission('registry.manage', division_id));
DROP POLICY IF EXISTS assessment_components_scoped ON assessment_components;
CREATE POLICY assessment_components_scoped ON assessment_components FOR SELECT TO authenticated USING (upwa_has_permission('academics.read', division_id));
DROP POLICY IF EXISTS assessment_components_manage ON assessment_components;
CREATE POLICY assessment_components_manage ON assessment_components FOR ALL TO authenticated USING (upwa_has_permission('registry.manage', division_id)) WITH CHECK (upwa_has_permission('registry.manage', division_id));
DROP POLICY IF EXISTS assessment_scores_read ON assessment_scores;
CREATE POLICY assessment_scores_read ON assessment_scores FOR SELECT TO authenticated USING (upwa_can_access_student(student_id, division_id, class_id) AND (status = 'PUBLISHED' OR upwa_has_permission('academics.read', division_id)));
DROP POLICY IF EXISTS assessment_scores_manage ON assessment_scores;
CREATE POLICY assessment_scores_manage ON assessment_scores FOR INSERT TO authenticated WITH CHECK (upwa_can_manage_class(class_id) AND entered_by = auth.uid() AND status IN ('DRAFT','SUBMITTED'));
DROP POLICY IF EXISTS assessment_scores_update ON assessment_scores;
CREATE POLICY assessment_scores_update ON assessment_scores FOR UPDATE TO authenticated USING (upwa_can_manage_class(class_id) AND status IN ('DRAFT','SUBMITTED','REVIEWED')) WITH CHECK (upwa_can_manage_class(class_id) AND status IN ('DRAFT','SUBMITTED','REVIEWED'));

DROP POLICY IF EXISTS attendance_records_scoped_read ON attendance_records;
CREATE POLICY attendance_records_scoped_read ON attendance_records FOR SELECT TO authenticated USING (upwa_can_access_student(student_id, division_id, class_id));
DROP POLICY IF EXISTS attendance_records_class_manage ON attendance_records;
CREATE POLICY attendance_records_class_manage ON attendance_records FOR INSERT TO authenticated WITH CHECK (upwa_can_manage_class(class_id) AND recorded_by = auth.uid());
DROP POLICY IF EXISTS attendance_records_class_update ON attendance_records;
CREATE POLICY attendance_records_class_update ON attendance_records FOR UPDATE TO authenticated USING (upwa_can_manage_class(class_id)) WITH CHECK (upwa_can_manage_class(class_id));

DROP POLICY IF EXISTS daily_care_assigned_read ON daily_care_logs;
CREATE POLICY daily_care_assigned_read ON daily_care_logs FOR SELECT TO authenticated USING (
  (upwa_has_permission('care.manage', division_id) AND upwa_can_manage_class(class_id))
  OR (guardian_visible AND upwa_is_guardian_of(student_id))
);
DROP POLICY IF EXISTS daily_care_assigned_insert ON daily_care_logs;
CREATE POLICY daily_care_assigned_insert ON daily_care_logs FOR INSERT TO authenticated WITH CHECK (
  upwa_has_permission('care.manage', division_id) AND upwa_can_manage_class(class_id) AND created_by = auth.uid()
);
DROP POLICY IF EXISTS daily_care_assigned_update ON daily_care_logs;
CREATE POLICY daily_care_assigned_update ON daily_care_logs FOR UPDATE TO authenticated
USING (upwa_has_permission('care.manage', division_id) AND upwa_can_manage_class(class_id) AND created_by = auth.uid())
WITH CHECK (upwa_has_permission('care.manage', division_id) AND upwa_can_manage_class(class_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS timetable_scoped_read ON timetable_periods;
CREATE POLICY timetable_scoped_read ON timetable_periods FOR SELECT TO authenticated USING (upwa_has_permission('academics.read', division_id));
DROP POLICY IF EXISTS timetable_manage ON timetable_periods;
CREATE POLICY timetable_manage ON timetable_periods FOR ALL TO authenticated USING (upwa_has_permission('registry.manage', division_id)) WITH CHECK (upwa_has_permission('registry.manage', division_id));

-- Review, decisions and applicant records stay private. Public application entry is provided by the tokenized RPC in the secure policy migration.
DROP POLICY IF EXISTS admissions_staff_read ON admission_applications;
CREATE POLICY admissions_staff_read ON admission_applications FOR SELECT TO authenticated USING (upwa_has_permission('admissions.manage', division_id));
DROP POLICY IF EXISTS admissions_staff_update ON admission_applications;
CREATE POLICY admissions_staff_update ON admission_applications FOR UPDATE TO authenticated USING (upwa_has_permission('admissions.manage', division_id)) WITH CHECK (upwa_has_permission('admissions.manage', division_id));
DROP POLICY IF EXISTS admission_documents_staff_read ON admission_documents;
CREATE POLICY admission_documents_staff_read ON admission_documents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM admission_applications a WHERE a.id = application_id AND upwa_has_permission('admissions.manage', a.division_id)));
DROP POLICY IF EXISTS admission_documents_staff_manage ON admission_documents;
CREATE POLICY admission_documents_staff_manage ON admission_documents FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM admission_applications a WHERE a.id = application_id AND upwa_has_permission('admissions.manage', a.division_id))) WITH CHECK (EXISTS (SELECT 1 FROM admission_applications a WHERE a.id = application_id AND upwa_has_permission('admissions.manage', a.division_id)));
DROP POLICY IF EXISTS admission_history_staff_read ON admission_history;
CREATE POLICY admission_history_staff_read ON admission_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM admission_applications a WHERE a.id = application_id AND upwa_has_permission('admissions.manage', a.division_id)));

DROP POLICY IF EXISTS cms_public_read ON cms_entries;
CREATE POLICY cms_public_read ON cms_entries FOR SELECT TO anon, authenticated USING (status = 'PUBLISHED');
DROP POLICY IF EXISTS cms_editor_manage ON cms_entries;
CREATE POLICY cms_editor_manage ON cms_entries FOR ALL TO authenticated USING (upwa_has_permission('cms.manage', division_id)) WITH CHECK (upwa_has_permission('cms.manage', division_id));
DROP POLICY IF EXISTS cms_public_settings_read ON cms_site_settings;
CREATE POLICY cms_public_settings_read ON cms_site_settings FOR SELECT TO anon, authenticated USING (is_public = true);
DROP POLICY IF EXISTS cms_settings_editor_manage ON cms_site_settings;
CREATE POLICY cms_settings_editor_manage ON cms_site_settings FOR ALL TO authenticated USING (upwa_has_permission('cms.manage')) WITH CHECK (upwa_has_permission('cms.manage'));

-- Medical alerts are strictly separate from ordinary student profiles.
DROP POLICY IF EXISTS student_medical_staff_read ON student_medical_alerts;
CREATE POLICY student_medical_staff_read ON student_medical_alerts FOR SELECT TO authenticated USING (
  upwa_has_role(ARRAY['PRIMARY_HEAD_TEACHER','SECONDARY_PRINCIPAL','SCHOOL_NURSE'], division_id)
  OR (upwa_has_role(ARRAY['CRECHE_CAREGIVER'], division_id) AND EXISTS (
    SELECT 1 FROM staff_profiles sp JOIN staff_class_assignments a ON a.staff_profile_id = sp.id
    JOIN students s ON s.current_class_id = a.class_id
    WHERE sp.user_id = auth.uid() AND s.id = student_id
  ))
);
DROP POLICY IF EXISTS student_medical_staff_manage ON student_medical_alerts;
CREATE POLICY student_medical_staff_manage ON student_medical_alerts FOR ALL TO authenticated USING (
  upwa_has_role(ARRAY['PRIMARY_HEAD_TEACHER','SECONDARY_PRINCIPAL','SCHOOL_NURSE'], division_id)
) WITH CHECK (
  upwa_has_role(ARRAY['PRIMARY_HEAD_TEACHER','SECONDARY_PRINCIPAL','SCHOOL_NURSE'], division_id)
);

DROP POLICY IF EXISTS audit_technical_admin_read ON audit_logs;
CREATE POLICY audit_technical_admin_read ON audit_logs FOR SELECT TO authenticated USING (upwa_has_permission('audit.read'));

-- Public status tracking requires a high-entropy secret delivered to the applicant,
-- never a student ID or phone-number combination. Only a minimal status payload is returned.
CREATE OR REPLACE FUNCTION upwa_track_application(p_token TEXT)
RETURNS TABLE(application_number TEXT, status TEXT, exam_at TIMESTAMPTZ, exam_venue TEXT, updated_at TIMESTAMPTZ)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT a.application_number, a.status, a.exam_at, a.exam_venue, a.updated_at
  FROM admission_applications a
  WHERE a.tracking_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION upwa_track_application(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upwa_track_application(TEXT) TO anon, authenticated;

-- Grant the browser only the minimum supported API capabilities; RLS remains authoritative.
GRANT SELECT ON roles, permissions, role_permissions TO authenticated;
GRANT SELECT ON user_profiles, user_roles, school_divisions, school_sections, classes, class_arms, subjects,
  data_import_jobs, staff_profiles, staff_class_assignments, student_accounts, student_enrolments, academic_division_settings,
  division_academic_calendars, assessment_components, assessment_scores, attendance_records, daily_care_logs, timetable_periods, admission_applications,
  admission_documents, admission_history, cms_entries, cms_site_settings, student_medical_alerts, audit_logs TO authenticated;
GRANT INSERT, UPDATE ON user_profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON role_permissions, user_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON classes, subjects, data_import_jobs, staff_profiles, staff_class_assignments, student_enrolments,
  academic_division_settings, division_academic_calendars, assessment_components, assessment_scores, attendance_records, daily_care_logs, timetable_periods,
  admission_applications, admission_documents, cms_entries, cms_site_settings, student_medical_alerts TO authenticated;
GRANT SELECT ON cms_entries TO anon;
GRANT SELECT ON cms_site_settings TO anon;

-- Ensure new audit records are not directly writable through the public API.
REVOKE INSERT, UPDATE, DELETE ON audit_logs, admission_history FROM anon, authenticated;
