-- UPWA-ISMS Initial PostgreSQL Schema & Financial Integrity Controls
-- Developed and Managed by Jojuni Technologies Limited for UPWA International Schools

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Institutions & Divisions
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'UPWA International Schools',
  short_name TEXT NOT NULL DEFAULT 'UPWA-ISMS',
  address TEXT,
  crest_asset_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE CHECK (code IN ('PRIMARY_EARLY_YEARS', 'SECONDARY')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (division_id, name)
);

-- 2. Academic Sessions, Terms & Classes
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  starts_on DATE,
  ends_on DATE
);

CREATE TABLE IF NOT EXISTS terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (session_id, name)
);

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id) ON DELETE CASCADE,
  section_id UUID REFERENCES school_sections(id),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (division_id, name)
);

-- 3. Users, Roles & Multi-Role RBAC
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  division_id UUID REFERENCES school_divisions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role_id, division_id)
);

-- 4. Longitudinal Student & Guardian Registry
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_number TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  current_division_id UUID NOT NULL REFERENCES school_divisions(id),
  current_class_id UUID REFERENCES classes(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'GRADUATED', 'TRANSFERRED', 'WITHDRAWN')),
  photo_storage_path TEXT,
  medical_alerts_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_guardians (
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  is_primary_payer BOOLEAN NOT NULL DEFAULT FALSE,
  can_authorize_pickup BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (student_id, guardian_id)
);

-- 5. Assessments, Approval Locks & Cryptographic QR Verification
CREATE TABLE IF NOT EXISTS score_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id),
  term_id UUID NOT NULL REFERENCES terms(id),
  subject_code TEXT NOT NULL,
  ca1 NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (ca1 >= 0 AND ca1 <= 20),
  ca2 NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (ca2 >= 0 AND ca2 <= 20),
  exam NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (exam >= 0 AND exam <= 60),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'PUBLISHED')),
  locked_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, session_id, term_id, subject_code)
);

CREATE TABLE IF NOT EXISTS report_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_reference TEXT NOT NULL UNIQUE,
  student_id UUID NOT NULL REFERENCES students(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  term_id UUID NOT NULL REFERENCES terms(id),
  version INT NOT NULL DEFAULT 1,
  hmac_signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VALID' CHECK (status IN ('VALID', 'REVOKED', 'SUPERSEDED')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Financial Tracker (Idempotent Webhooks, Invoices, Receipts & Immutable Ledger)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  student_id UUID NOT NULL REFERENCES students(id),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  term_id UUID NOT NULL REFERENCES terms(id),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID', 'VOID')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gateway_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_reference TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_channel TEXT NOT NULL CHECK (payment_channel IN ('PAYSTACK', 'FLUTTERWAVE', 'BANK_TRANSFER', 'POS', 'CASH')),
  external_reference TEXT UNIQUE,
  issued_by UUID REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('INCOME', 'EXPENSE', 'REVERSAL')),
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  reference_code TEXT NOT NULL UNIQUE,
  reverses_entry_id UUID REFERENCES ledger_entries(id),
  approved_by UUID NOT NULL REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent destructive updates or deletes on posted financial ledger entries
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Posted ledger_entries are immutable. Create a REVERSAL entry instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_ledger ON ledger_entries;
CREATE TRIGGER trg_immutable_ledger
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

-- 7. Digital Gate Pass & Child Pickup Security
CREATE TABLE IF NOT EXISTS pickup_authorisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  collector_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  photo_storage_path TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pickup_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  authorisation_id UUID NOT NULL REFERENCES pickup_authorisations(id),
  pickup_date DATE NOT NULL DEFAULT CURRENT_DATE,
  released_by UUID NOT NULL REFERENCES auth.users(id),
  released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevent duplicate checkout of the same child on the same school day
  UNIQUE (student_id, pickup_date)
);

-- 8. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security across sensitive tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_events ENABLE ROW LEVEL SECURITY;
