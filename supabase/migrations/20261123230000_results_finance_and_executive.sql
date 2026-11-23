-- Configurable assessment workflow, private published report snapshots,
-- and a traceable double-entry-oriented finance operations foundation.

INSERT INTO permissions (code, description) VALUES
  ('results.read', 'Read published results for linked students or authorised classes'),
  ('results.review', 'Review submitted score batches'),
  ('results.publish', 'Approve and publish reviewed score batches'),
  ('finance.reconcile', 'Reconcile verified settlements against bank statement lines'),
  ('finance.expense_approve', 'Approve expense requests in an assigned division'),
  ('finance.adjust', 'Approve fee discounts, waivers, credits and adjustments')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM roles r JOIN permissions p ON
  (r.code IN ('EXAMINATIONS_OFFICER','PRIMARY_HEAD_TEACHER','SECONDARY_PRINCIPAL') AND p.code = 'results.review') OR
  (r.code IN ('PRIMARY_HEAD_TEACHER','SECONDARY_PRINCIPAL') AND p.code = 'results.publish') OR
  (r.code IN ('BURSAR_ACCOUNTANT','UPWA_PRESIDENT','EXECUTIVE_BOARD') AND p.code IN ('finance.reconcile')) OR
  (r.code IN ('PRIMARY_HEAD_TEACHER','SECONDARY_PRINCIPAL','UPWA_PRESIDENT','EXECUTIVE_BOARD') AND p.code IN ('finance.expense_approve','finance.adjust'))
ON CONFLICT DO NOTHING;

ALTER TABLE assessment_scores ADD COLUMN IF NOT EXISTS score_state TEXT NOT NULL DEFAULT 'PRESENT'
  CHECK (score_state IN ('PRESENT','ABSENT','MISSING'));
ALTER TABLE assessment_components ADD COLUMN IF NOT EXISTS weight NUMERIC(7,2) NOT NULL DEFAULT 1 CHECK (weight > 0);
ALTER TABLE assessment_components ADD COLUMN IF NOT EXISTS precision_digits SMALLINT NOT NULL DEFAULT 2 CHECK (precision_digits BETWEEN 0 AND 4);
ALTER TABLE assessment_components ADD COLUMN IF NOT EXISTS counts_toward_total BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS assessment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  term_id UUID NOT NULL REFERENCES terms(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','PUBLISHED','CORRECTION_REQUESTED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  correction_note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id, session_id, term_id, version)
);
CREATE INDEX IF NOT EXISTS assessment_batches_queue_idx ON assessment_batches(division_id, status, updated_at DESC);

CREATE OR REPLACE FUNCTION upwa_validate_assessment_batch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_class_division UUID; v_subject_division UUID; v_term_session UUID;
BEGIN
  SELECT division_id INTO v_class_division FROM classes WHERE id=NEW.class_id;
  SELECT division_id INTO v_subject_division FROM subjects WHERE id=NEW.subject_id;
  SELECT session_id INTO v_term_session FROM terms WHERE id=NEW.term_id;
  IF v_class_division IS DISTINCT FROM NEW.division_id OR v_subject_division IS DISTINCT FROM NEW.division_id THEN
    RAISE EXCEPTION 'Assessment class and subject must belong to its division';
  END IF;
  IF v_term_session IS DISTINCT FROM NEW.session_id THEN RAISE EXCEPTION 'Assessment term must belong to its session'; END IF;
  IF TG_OP='UPDATE' AND (NEW.division_id,NEW.class_id,NEW.subject_id,NEW.session_id,NEW.term_id) IS DISTINCT FROM
      (OLD.division_id,OLD.class_id,OLD.subject_id,OLD.session_id,OLD.term_id) THEN
    RAISE EXCEPTION 'Assessment batch scope is immutable';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_upwa_validate_assessment_batch ON assessment_batches;
CREATE TRIGGER trg_upwa_validate_assessment_batch BEFORE INSERT OR UPDATE ON assessment_batches
FOR EACH ROW EXECUTE FUNCTION upwa_validate_assessment_batch();

CREATE OR REPLACE FUNCTION upwa_can_manage_assessment(p_class_id UUID,p_subject_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public,auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM classes c WHERE c.id=p_class_id AND (
      (upwa_has_permission('academics.manage',c.division_id) AND upwa_has_role(ARRAY['PRIMARY_HEAD_TEACHER','SECONDARY_PRINCIPAL','EXAMINATIONS_OFFICER'],c.division_id))
      OR EXISTS (
        SELECT 1 FROM staff_class_assignments sca JOIN staff_profiles sp ON sp.id=sca.staff_profile_id
        JOIN user_roles ur ON ur.user_id=sp.user_id AND ur.division_id=c.division_id
        JOIN roles r ON r.id=ur.role_id AND r.code IN ('TEACHER','CRECHE_CAREGIVER')
        WHERE sca.class_id=c.id AND sp.user_id=auth.uid() AND sp.employment_status='ACTIVE'
          AND (sca.assignment_role='CLASS_TEACHER' OR sca.subject_id=p_subject_id)
      )
    )
  );
$$;

CREATE TABLE IF NOT EXISTS assessment_score_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES assessment_batches(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, version)
);

CREATE TABLE IF NOT EXISTS assessment_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES assessment_batches(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 2000),
  proposed_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','APPLIED')),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_behaviour_appraisals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  term_id UUID NOT NULL REFERENCES terms(id),
  appraisal_key TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('EXCELLENT','VERY_GOOD','GOOD','SATISFACTORY','NEEDS_SUPPORT')),
  teacher_remark TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','PUBLISHED')),
  entered_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, session_id, term_id, appraisal_key)
);

ALTER TABLE report_verification ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES school_divisions(id);
ALTER TABLE report_verification ADD COLUMN IF NOT EXISTS issuer TEXT NOT NULL DEFAULT 'UPWA International Schools';
ALTER TABLE report_verification ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES report_verification(id);
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY student_id,session_id,term_id ORDER BY issued_at,id)::INTEGER AS next_version,
    count(*) OVER (PARTITION BY student_id,session_id,term_id) AS version_count,
    lead(id) OVER (PARTITION BY student_id,session_id,term_id ORDER BY issued_at,id) AS next_id
  FROM report_verification
)
UPDATE report_verification rv SET version=ranked.next_version,
  status=CASE WHEN rv.status='VALID' AND ranked.next_version<ranked.version_count THEN 'SUPERSEDED' ELSE rv.status END,
  superseded_by=CASE WHEN rv.status='VALID' AND ranked.next_version<ranked.version_count THEN ranked.next_id ELSE rv.superseded_by END
FROM ranked WHERE rv.id=ranked.id;
CREATE UNIQUE INDEX IF NOT EXISTS report_version_unique_idx ON report_verification(student_id,session_id,term_id,version);
CREATE TABLE IF NOT EXISTS report_card_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL UNIQUE REFERENCES report_verification(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  term_id UUID NOT NULL REFERENCES terms(id),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  snapshot JSONB NOT NULL,
  issued_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  class_id UUID REFERENCES classes(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  term_id UUID NOT NULL REFERENCES terms(id),
  student_category TEXT NOT NULL DEFAULT 'ANY' CHECK (student_category IN ('ANY','DAY','BOARDING')),
  fee_code TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  due_on DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (division_id, class_id, session_id, term_id, student_category, fee_code)
);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS student_category TEXT NOT NULL DEFAULT 'DAY' CHECK (student_category IN ('DAY','BOARDING'));
CREATE TABLE IF NOT EXISTS finance_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  fee_code TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount NUMERIC(12,2) NOT NULL CHECK (unit_amount >= 0),
  line_amount NUMERIC(12,2) GENERATED ALWAYS AS (round(quantity * unit_amount, 2)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fee_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('SIBLING_DISCOUNT','STAFF_REBATE','SCHOLARSHIP','WAIVER','CREDIT','MANUAL')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','APPLIED')),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (approved_by IS NULL OR approved_by <> requested_by)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  student_id UUID NOT NULL REFERENCES students(id),
  provider TEXT NOT NULL CHECK (provider IN ('PAYSTACK','FLUTTERWAVE','BANK_TRANSFER','CASH','POS')),
  external_reference TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','EVIDENCE_SUBMITTED','VERIFIED','REJECTED','REVERSED')),
  provider_status TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  settlement_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status <> 'VERIFIED') OR verified_at IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payment_transactions(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  allocated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_id, invoice_id)
);
CREATE TABLE IF NOT EXISTS payment_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS finance_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES payment_transactions(id),
  receipt_number TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by UUID REFERENCES auth.users(id),
  document_hash TEXT
);

CREATE TABLE IF NOT EXISTS finance_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  category TEXT NOT NULL CHECK (category IN ('PAYROLL','DIESEL','UTILITIES','TEACHING_MATERIALS','STATIONERY','MAINTENANCE','REPAIRS','REMITTANCES','OTHER')),
  payee TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL,
  document_path TEXT,
  requestor_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','PAID','VOID')),
  payment_reference TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  paid_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ,
  ledger_entry_id UUID UNIQUE REFERENCES ledger_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (approved_by IS NULL OR approved_by <> requestor_id),
  CHECK (paid_by IS NULL OR approved_by IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS finance_expense_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES finance_expenses(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('SUBMITTED','REVIEWED','APPROVED','REJECTED','PAID','CORRECTED')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  account_reference TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  opening_balance NUMERIC(14,2) NOT NULL,
  closing_balance NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_REVIEW','RECONCILED')),
  prepared_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  CHECK (approved_by IS NULL OR approved_by <> prepared_by)
);
CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  amount NUMERIC(14,2) NOT NULL,
  matched_payment_id UUID REFERENCES payment_transactions(id),
  matched_ledger_entry_id UUID REFERENCES ledger_entries(id),
  matched_at TIMESTAMPTZ,
  matched_by UUID REFERENCES auth.users(id),
  UNIQUE (reconciliation_id, reference)
);

CREATE TABLE IF NOT EXISTS finance_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID REFERENCES school_divisions(id),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE assessment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_score_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_behaviour_appraisals ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_card_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expense_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY assessment_batches_authorised_read ON assessment_batches FOR SELECT TO authenticated USING (
  upwa_has_permission('academics.read', division_id) OR upwa_has_permission('results.review', division_id)
  OR EXISTS (SELECT 1 FROM students s WHERE s.current_class_id = class_id AND upwa_is_guardian_of(s.id))
);
CREATE POLICY assessment_batches_teacher_insert ON assessment_batches FOR INSERT TO authenticated WITH CHECK (
  upwa_can_manage_assessment(class_id,subject_id) AND status = 'DRAFT'
);
CREATE POLICY assessment_batches_teacher_update ON assessment_batches FOR UPDATE TO authenticated
USING (upwa_can_manage_class(class_id) AND status IN ('DRAFT','CORRECTION_REQUESTED'))
WITH CHECK (upwa_can_manage_class(class_id) AND status IN ('DRAFT','CORRECTION_REQUESTED'));
CREATE POLICY assessment_versions_authorised_read ON assessment_score_versions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM assessment_batches b WHERE b.id = batch_id AND (upwa_has_permission('results.review', b.division_id) OR upwa_has_permission('academics.read', b.division_id)))
);
CREATE POLICY assessment_requests_authorised_read ON assessment_change_requests FOR SELECT TO authenticated USING (
  requested_by = auth.uid() OR EXISTS (SELECT 1 FROM assessment_batches b WHERE b.id = batch_id AND upwa_has_permission('results.review', b.division_id))
);
CREATE POLICY assessment_requests_teacher_insert ON assessment_change_requests FOR INSERT TO authenticated WITH CHECK (
  requested_by = auth.uid() AND EXISTS (SELECT 1 FROM assessment_batches b WHERE b.id = batch_id AND b.status IN ('PUBLISHED','APPROVED') AND upwa_can_manage_assessment(b.class_id,b.subject_id))
);
CREATE POLICY behaviour_parent_or_staff_read ON student_behaviour_appraisals FOR SELECT TO authenticated USING (
  status = 'PUBLISHED' AND upwa_can_access_student(student_id, division_id, class_id)
  OR upwa_has_permission('academics.read', division_id)
);
CREATE POLICY report_snapshot_self_scope ON report_card_snapshots FOR SELECT TO authenticated USING (
  upwa_can_access_student(student_id, division_id, NULL)
);

CREATE POLICY fee_schedules_finance_read ON fee_schedules FOR SELECT TO authenticated USING (
  upwa_has_permission('finance.read', division_id) OR upwa_has_permission('finance.manage', division_id)
);
CREATE POLICY fee_schedules_finance_manage ON fee_schedules FOR ALL TO authenticated USING (upwa_has_permission('finance.manage', division_id)) WITH CHECK (upwa_has_permission('finance.manage', division_id));
CREATE POLICY invoice_items_finance_read ON finance_invoice_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND (upwa_has_permission('finance.read', i.division_id) OR upwa_is_guardian_of(i.student_id)))
);
CREATE POLICY invoice_items_finance_manage ON finance_invoice_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND upwa_has_permission('finance.manage', i.division_id))
) WITH CHECK (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND upwa_has_permission('finance.manage', i.division_id)));
CREATE POLICY fee_adjustments_scoped_read ON fee_adjustments FOR SELECT TO authenticated USING (requested_by = auth.uid() OR upwa_has_permission('finance.read', division_id));
CREATE POLICY fee_adjustments_request ON fee_adjustments FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid() AND upwa_has_permission('finance.manage', division_id));
CREATE POLICY fee_adjustments_approve ON fee_adjustments FOR UPDATE TO authenticated USING (upwa_has_permission('finance.adjust', division_id)) WITH CHECK (upwa_has_permission('finance.adjust', division_id) AND approved_by = auth.uid() AND approved_by <> requested_by);

CREATE POLICY payment_transactions_scoped_read ON payment_transactions FOR SELECT TO authenticated USING (
  upwa_has_permission('finance.read', division_id) OR upwa_is_guardian_of(student_id)
);
CREATE POLICY payment_transactions_finance_manage ON payment_transactions FOR ALL TO authenticated USING (upwa_has_permission('finance.manage', division_id)) WITH CHECK (upwa_has_permission('finance.manage', division_id));
CREATE POLICY payment_allocations_scoped_read ON payment_allocations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM payment_transactions p WHERE p.id = payment_id AND (upwa_has_permission('finance.read', p.division_id) OR upwa_is_guardian_of(p.student_id)))
);
CREATE POLICY payment_allocations_finance_manage ON payment_allocations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM payment_transactions p WHERE p.id = payment_id AND upwa_has_permission('finance.manage', p.division_id))
) WITH CHECK (EXISTS (SELECT 1 FROM payment_transactions p WHERE p.id = payment_id AND upwa_has_permission('finance.manage', p.division_id)));
CREATE POLICY payment_evidence_scoped_read ON payment_evidence FOR SELECT TO authenticated USING (
  submitted_by = auth.uid() OR EXISTS (SELECT 1 FROM payment_transactions p WHERE p.id = payment_id AND upwa_has_permission('finance.read', p.division_id))
);
CREATE POLICY finance_receipts_scoped_read ON finance_receipts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM payment_transactions p WHERE p.id = payment_id AND (upwa_has_permission('finance.read', p.division_id) OR upwa_is_guardian_of(p.student_id)))
);
CREATE POLICY expenses_scoped_read ON finance_expenses FOR SELECT TO authenticated USING (upwa_has_permission('finance.read', division_id) OR requestor_id = auth.uid());
CREATE POLICY expenses_create ON finance_expenses FOR INSERT TO authenticated WITH CHECK (requestor_id = auth.uid() AND upwa_has_permission('finance.manage', division_id));
CREATE POLICY expenses_approval ON finance_expenses FOR UPDATE TO authenticated USING (
  upwa_has_permission('finance.expense_approve', division_id) OR (upwa_has_permission('finance.manage', division_id) AND requestor_id = auth.uid())
) WITH CHECK (
  (upwa_has_permission('finance.expense_approve', division_id) AND (approved_by IS NULL OR approved_by <> requestor_id))
  OR (upwa_has_permission('finance.manage', division_id) AND requestor_id = auth.uid() AND status IN ('SUBMITTED','UNDER_REVIEW'))
);
CREATE POLICY expense_approval_read ON finance_expense_approvals FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM finance_expenses e WHERE e.id = expense_id AND (upwa_has_permission('finance.read', e.division_id) OR e.requestor_id = auth.uid()))
);
CREATE POLICY reconciliations_scoped_read ON bank_reconciliations FOR SELECT TO authenticated USING (upwa_has_permission('finance.read', division_id));
CREATE POLICY reconciliations_manage ON bank_reconciliations FOR ALL TO authenticated USING (upwa_has_permission('finance.reconcile', division_id)) WITH CHECK (upwa_has_permission('finance.reconcile', division_id));
CREATE POLICY bank_lines_scoped_read ON bank_statement_lines FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM bank_reconciliations r WHERE r.id = reconciliation_id AND upwa_has_permission('finance.read', r.division_id))
);
CREATE POLICY bank_lines_manage ON bank_statement_lines FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM bank_reconciliations r WHERE r.id = reconciliation_id AND upwa_has_permission('finance.reconcile', r.division_id))
) WITH CHECK (EXISTS (SELECT 1 FROM bank_reconciliations r WHERE r.id = reconciliation_id AND upwa_has_permission('finance.reconcile', r.division_id)));
CREATE POLICY finance_activity_read ON finance_activity FOR SELECT TO authenticated USING (
  upwa_has_permission('finance.read', division_id) OR upwa_has_permission('executive.read')
);

GRANT SELECT ON sessions, terms TO authenticated;
GRANT SELECT, INSERT, UPDATE ON assessment_batches, assessment_score_versions, assessment_change_requests, student_behaviour_appraisals, report_card_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_schedules, finance_invoice_items, fee_adjustments, payment_transactions, payment_allocations, payment_evidence, finance_receipts, finance_expenses, finance_expense_approvals, bank_reconciliations, bank_statement_lines TO authenticated;
GRANT SELECT ON finance_activity TO authenticated;

-- Immutable evidence and workflow-owned tables are readable directly but changed only through guarded RPCs.
REVOKE UPDATE, DELETE ON assessment_batches, assessment_score_versions, assessment_change_requests, report_card_snapshots FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON finance_invoice_items, payment_allocations, finance_receipts, finance_expense_approvals FROM anon, authenticated;
REVOKE UPDATE, DELETE ON finance_expenses FROM anon, authenticated;
GRANT SELECT, INSERT ON assessment_batches, assessment_change_requests TO authenticated;
GRANT SELECT ON assessment_score_versions, report_card_snapshots, finance_invoice_items, payment_allocations, finance_receipts, finance_expense_approvals TO authenticated;
GRANT SELECT, INSERT ON finance_expenses TO authenticated;

CREATE OR REPLACE FUNCTION upwa_finance_summary(p_division_id UUID DEFAULT NULL, p_from DATE DEFAULT NULL, p_to DATE DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_result JSONB;
BEGIN
  IF NOT (upwa_has_permission('executive.read') OR upwa_has_permission('finance.read', p_division_id)) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT jsonb_build_object(
    'billed', COALESCE((SELECT sum(i.total_amount) FROM invoices i WHERE (p_division_id IS NULL OR i.division_id=p_division_id) AND (p_from IS NULL OR i.created_at::date >= p_from) AND (p_to IS NULL OR i.created_at::date <= p_to)),0),
    'collected', COALESCE((SELECT sum(p.amount) FROM payment_transactions p WHERE p.status='VERIFIED' AND (p_division_id IS NULL OR p.division_id=p_division_id) AND (p_from IS NULL OR p.verified_at::date >= p_from) AND (p_to IS NULL OR p.verified_at::date <= p_to)),0),
    'unpaid', COALESCE((SELECT sum(GREATEST(i.total_amount - COALESCE(x.paid,0),0)) FROM invoices i LEFT JOIN LATERAL (SELECT sum(pa.amount) paid FROM payment_allocations pa JOIN payment_transactions p ON p.id=pa.payment_id AND p.status='VERIFIED' WHERE pa.invoice_id=i.id) x ON true WHERE (p_division_id IS NULL OR i.division_id=p_division_id)),0),
    'nonTuitionIncome', COALESCE((SELECT sum(le.amount) FROM ledger_entries le WHERE le.entry_type='INCOME' AND (p_division_id IS NULL OR le.division_id=p_division_id) AND (p_from IS NULL OR le.posted_at::date >= p_from) AND (p_to IS NULL OR le.posted_at::date <= p_to)),0),
    'expensesApproved', COALESCE((SELECT sum(e.amount) FROM finance_expenses e WHERE e.status IN ('APPROVED','PAID') AND (p_division_id IS NULL OR e.division_id=p_division_id) AND (p_from IS NULL OR e.expense_date >= p_from) AND (p_to IS NULL OR e.expense_date <= p_to)),0),
    'expensesPaid', COALESCE((SELECT sum(e.amount) FROM finance_expenses e WHERE e.status='PAID' AND (p_division_id IS NULL OR e.division_id=p_division_id) AND (p_from IS NULL OR e.expense_date >= p_from) AND (p_to IS NULL OR e.expense_date <= p_to)),0),
    'netCashMovement', COALESCE((SELECT sum(p.amount) FROM payment_transactions p WHERE p.status='VERIFIED' AND (p_division_id IS NULL OR p.division_id=p_division_id) AND (p_from IS NULL OR p.verified_at::date >= p_from) AND (p_to IS NULL OR p.verified_at::date <= p_to)),0) - COALESCE((SELECT sum(e.amount) FROM finance_expenses e WHERE e.status='PAID' AND (p_division_id IS NULL OR e.division_id=p_division_id) AND (p_from IS NULL OR e.expense_date >= p_from) AND (p_to IS NULL OR e.expense_date <= p_to)),0),
    'reconciledCash', (SELECT r.closing_balance FROM bank_reconciliations r WHERE r.status='RECONCILED' AND (p_division_id IS NULL OR r.division_id=p_division_id) ORDER BY r.period_end DESC, r.reconciled_at DESC LIMIT 1)
  ) INTO v_result;
  RETURN v_result;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_finance_summary(UUID,DATE,DATE) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_apply_verified_payment(p_payment_id UUID, p_invoice_id UUID, p_amount NUMERIC)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_payment payment_transactions%ROWTYPE; v_invoice invoices%ROWTYPE; v_receipt UUID; v_allocated NUMERIC;
BEGIN
  SELECT * INTO v_payment FROM payment_transactions WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND OR NOT upwa_has_permission('finance.manage',v_payment.division_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT * INTO v_invoice FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF v_payment.id IS NULL OR v_invoice.id IS NULL OR v_payment.status <> 'VERIFIED' OR v_payment.student_id <> v_invoice.student_id OR v_payment.division_id <> v_invoice.division_id THEN RAISE EXCEPTION 'Verified payment and invoice must belong to the same pupil and division'; END IF;
  IF p_amount <= 0 OR p_amount > v_payment.amount THEN RAISE EXCEPTION 'Invalid allocation amount'; END IF;
  SELECT COALESCE(sum(amount),0) INTO v_allocated FROM payment_allocations WHERE payment_id=p_payment_id;
  IF v_allocated + p_amount > v_payment.amount THEN RAISE EXCEPTION 'Payment cannot be over-allocated'; END IF;
  SELECT GREATEST(total_amount-COALESCE((SELECT sum(pa.amount) FROM payment_allocations pa JOIN payment_transactions t ON t.id=pa.payment_id AND t.status='VERIFIED' WHERE pa.invoice_id=p_invoice_id),0),0) INTO v_allocated FROM invoices WHERE id=p_invoice_id;
  IF p_amount > v_allocated THEN RAISE EXCEPTION 'Allocation exceeds the remaining invoice balance'; END IF;
  INSERT INTO payment_allocations(payment_id,invoice_id,amount,allocated_by) VALUES(p_payment_id,p_invoice_id,p_amount,auth.uid());
  UPDATE invoices SET amount_paid = LEAST(total_amount, amount_paid + p_amount), status = CASE WHEN amount_paid + p_amount >= total_amount THEN 'PAID' WHEN amount_paid + p_amount > 0 THEN 'PARTIAL' ELSE status END WHERE id=p_invoice_id;
  INSERT INTO finance_receipts(payment_id,receipt_number,issued_by) VALUES(p_payment_id,'UPWA-R-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),auth.uid()) ON CONFLICT(payment_id) DO UPDATE SET receipt_number=finance_receipts.receipt_number RETURNING id INTO v_receipt;
  INSERT INTO finance_activity(division_id,actor_id,action,entity_type,entity_id,metadata) VALUES(v_payment.division_id,auth.uid(),'PAYMENT_ALLOCATED','payment',p_payment_id,jsonb_build_object('invoice_id',p_invoice_id,'amount',p_amount));
  RETURN v_receipt;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_apply_verified_payment(UUID,UUID,NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_transition_assessment_batch(p_batch_id UUID,p_action TEXT,p_note TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_batch assessment_batches%ROWTYPE; v_next TEXT;
BEGIN
  SELECT * INTO v_batch FROM assessment_batches WHERE id=p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment batch not found'; END IF;
  IF p_action='SUBMIT' AND upwa_can_manage_assessment(v_batch.class_id,v_batch.subject_id) AND v_batch.status='DRAFT' THEN v_next:='SUBMITTED';
  ELSIF p_action='REVIEW' AND upwa_has_permission('results.review',v_batch.division_id) AND v_batch.status='SUBMITTED' AND v_batch.submitted_by IS DISTINCT FROM auth.uid() THEN v_next:='REVIEWED';
  ELSIF p_action='APPROVE' AND upwa_has_permission('results.publish',v_batch.division_id) AND v_batch.status='REVIEWED' AND v_batch.reviewed_by IS DISTINCT FROM auth.uid() THEN v_next:='APPROVED';
  ELSIF p_action='PUBLISH' AND upwa_has_permission('results.publish',v_batch.division_id) AND v_batch.status='APPROVED' AND v_batch.approved_by IS DISTINCT FROM auth.uid() THEN v_next:='PUBLISHED';
  ELSIF p_action='REQUEST_CORRECTION' AND upwa_has_permission('results.review',v_batch.division_id) AND v_batch.status IN ('SUBMITTED','REVIEWED','APPROVED','PUBLISHED') AND length(trim(COALESCE(p_note,'')))>=5 THEN v_next:='CORRECTION_REQUESTED';
  ELSE RAISE EXCEPTION 'Transition is not permitted from the current status'; END IF;
  IF p_action='PUBLISH' THEN
    IF EXISTS(SELECT 1 FROM assessment_scores s WHERE s.class_id=v_batch.class_id AND s.subject_id=v_batch.subject_id AND s.session_id=v_batch.session_id AND s.term_id=v_batch.term_id AND s.status<>'APPROVED' AND s.status<>'PUBLISHED') THEN RAISE EXCEPTION 'All scores must be approved before publication'; END IF;
    UPDATE assessment_scores SET status='PUBLISHED', published_at=now() WHERE class_id=v_batch.class_id AND subject_id=v_batch.subject_id AND session_id=v_batch.session_id AND term_id=v_batch.term_id;
  ELSIF p_action='APPROVE' THEN UPDATE assessment_scores SET status='APPROVED', approved_by=auth.uid() WHERE class_id=v_batch.class_id AND subject_id=v_batch.subject_id AND session_id=v_batch.session_id AND term_id=v_batch.term_id AND status='REVIEWED';
  ELSIF p_action='REVIEW' THEN UPDATE assessment_scores SET status='REVIEWED', reviewed_by=auth.uid() WHERE class_id=v_batch.class_id AND subject_id=v_batch.subject_id AND session_id=v_batch.session_id AND term_id=v_batch.term_id AND status='SUBMITTED';
  ELSIF p_action='SUBMIT' THEN UPDATE assessment_scores SET status='SUBMITTED' WHERE class_id=v_batch.class_id AND subject_id=v_batch.subject_id AND session_id=v_batch.session_id AND term_id=v_batch.term_id AND status='DRAFT';
  END IF;
  UPDATE assessment_batches SET status=v_next, updated_at=now(), locked_at=CASE WHEN p_action IN ('SUBMIT','APPROVE','PUBLISH') THEN now() ELSE locked_at END,
    submitted_by=CASE WHEN p_action='SUBMIT' THEN auth.uid() ELSE submitted_by END, submitted_at=CASE WHEN p_action='SUBMIT' THEN now() ELSE submitted_at END,
    reviewed_by=CASE WHEN p_action='REVIEW' THEN auth.uid() ELSE reviewed_by END, reviewed_at=CASE WHEN p_action='REVIEW' THEN now() ELSE reviewed_at END,
    approved_by=CASE WHEN p_action='APPROVE' THEN auth.uid() ELSE approved_by END, approved_at=CASE WHEN p_action='APPROVE' THEN now() ELSE approved_at END,
    published_by=CASE WHEN p_action='PUBLISH' THEN auth.uid() ELSE published_by END, published_at=CASE WHEN p_action='PUBLISH' THEN now() ELSE published_at END,
    correction_note=CASE WHEN p_action='REQUEST_CORRECTION' THEN p_note ELSE correction_note END
  WHERE id=p_batch_id;
  INSERT INTO finance_activity(division_id,actor_id,action,entity_type,entity_id,metadata) VALUES(v_batch.division_id,auth.uid(),'ASSESSMENT_'||p_action,'assessment_batch',v_batch.id,jsonb_build_object('status',v_next));
  RETURN v_next;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_transition_assessment_batch(UUID,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_executive_activity(p_division_id UUID DEFAULT NULL,p_limit INTEGER DEFAULT 50)
RETURNS TABLE(id UUID,action TEXT,entity_type TEXT,created_at TIMESTAMPTZ,actor_label TEXT,division_id UUID)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, auth AS $$
 SELECT a.id,a.action,a.entity_type,a.created_at,COALESCE(up.display_name,'Authorised staff'),a.division_id
 FROM finance_activity a LEFT JOIN user_profiles up ON up.user_id=a.actor_id
 WHERE upwa_has_permission('executive.read') AND (p_division_id IS NULL OR a.division_id=p_division_id)
 ORDER BY a.created_at DESC LIMIT LEAST(GREATEST(p_limit,1),100);
$$;
GRANT EXECUTE ON FUNCTION upwa_executive_activity(UUID,INTEGER) TO authenticated;

-- Scores are subject-specific even when a division shares component definitions.
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_category TEXT NOT NULL DEFAULT 'DAY'
  CHECK (student_category IN ('DAY','BOARDING'));
ALTER TABLE assessment_scores DROP CONSTRAINT IF EXISTS assessment_scores_student_id_component_id_session_id_term_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS assessment_scores_subject_identity_idx
  ON assessment_scores(student_id, component_id, session_id, term_id, subject_id);
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS grading_scale_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  grade_code TEXT NOT NULL,
  label TEXT NOT NULL,
  minimum_score NUMERIC(7,2) NOT NULL,
  maximum_score NUMERIC(7,2) NOT NULL,
  remark TEXT,
  UNIQUE (division_id, grade_code),
  CHECK (minimum_score >= 0 AND maximum_score <= 100 AND maximum_score >= minimum_score)
);
ALTER TABLE grading_scale_bands ENABLE ROW LEVEL SECURITY;
CREATE POLICY grading_bands_read ON grading_scale_bands FOR SELECT TO authenticated USING (upwa_has_permission('academics.read',division_id));
CREATE POLICY grading_bands_manage ON grading_scale_bands FOR ALL TO authenticated USING (upwa_has_permission('registry.manage',division_id)) WITH CHECK (upwa_has_permission('registry.manage',division_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON grading_scale_bands TO authenticated;

CREATE OR REPLACE FUNCTION upwa_save_assessment_scores(p_batch_id UUID,p_rows JSONB)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE b assessment_batches%ROWTYPE; r JSONB; s students%ROWTYPE; c assessment_components%ROWTYPE;
  v_state TEXT; v_score NUMERIC; v_development TEXT; v_count INTEGER:=0;
BEGIN
  SELECT * INTO b FROM assessment_batches WHERE id=p_batch_id FOR UPDATE;
  IF NOT FOUND OR b.status NOT IN ('DRAFT','CORRECTION_REQUESTED') OR NOT upwa_can_manage_assessment(b.class_id,b.subject_id) THEN RAISE EXCEPTION 'This score batch is locked or you are not assigned to its subject'; END IF;
  IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>2000 THEN RAISE EXCEPTION 'Invalid score rows'; END IF;
  IF EXISTS (SELECT 1 FROM assessment_scores WHERE class_id=b.class_id AND subject_id=b.subject_id AND session_id=b.session_id AND term_id=b.term_id AND status='PUBLISHED') THEN
    RAISE EXCEPTION 'Published marks require an approved correction request';
  END IF;
  IF EXISTS (SELECT 1 FROM assessment_scores WHERE class_id=b.class_id AND subject_id=b.subject_id AND session_id=b.session_id AND term_id=b.term_id) THEN
    INSERT INTO assessment_score_versions(batch_id,version,snapshot,actor_id,reason)
    SELECT b.id,b.version,jsonb_agg(to_jsonb(x)),auth.uid(),'Score sheet saved'
    FROM assessment_scores x WHERE x.class_id=b.class_id AND x.subject_id=b.subject_id AND x.session_id=b.session_id AND x.term_id=b.term_id
    ON CONFLICT(batch_id,version) DO UPDATE SET snapshot=EXCLUDED.snapshot,created_at=now();
  END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    SELECT * INTO s FROM students WHERE id=(r->>'student_id')::UUID AND current_class_id=b.class_id AND current_division_id=b.division_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'A pupil is not currently enrolled in this class'; END IF;
    SELECT * INTO c FROM assessment_components WHERE id=(r->>'component_id')::UUID AND division_id=b.division_id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assessment component is inactive or belongs to another division'; END IF;
    v_state:=COALESCE(r->>'score_state','PRESENT'); v_score:=NULLIF(r->>'numeric_score','')::NUMERIC; v_development:=NULLIF(trim(r->>'developmental_level'),'');
    IF v_state NOT IN ('PRESENT','ABSENT','MISSING') THEN RAISE EXCEPTION 'Invalid score state'; END IF;
    IF v_state<>'PRESENT' AND (v_score IS NOT NULL OR v_development IS NOT NULL) THEN RAISE EXCEPTION 'Absent or missing marks cannot carry a score'; END IF;
    IF v_state='PRESENT' AND c.is_developmental AND v_development IS NULL THEN RAISE EXCEPTION 'A developmental rating is required'; END IF;
    IF v_state='PRESENT' AND NOT c.is_developmental AND v_score IS NULL THEN RAISE EXCEPTION 'A numeric score is required'; END IF;
    IF v_score IS NOT NULL AND (v_score<0 OR v_score>c.maximum_score OR round(v_score,c.precision_digits)<>v_score) THEN RAISE EXCEPTION 'Score exceeds its configured maximum or precision'; END IF;
    INSERT INTO assessment_scores(student_id,division_id,class_id,subject_id,component_id,session_id,term_id,numeric_score,developmental_level,score_state,status,entered_by,updated_at)
    VALUES(s.id,b.division_id,b.class_id,b.subject_id,c.id,b.session_id,b.term_id,v_score,v_development,v_state,'DRAFT',auth.uid(),now())
    ON CONFLICT(student_id,component_id,session_id,term_id,subject_id) DO UPDATE SET numeric_score=EXCLUDED.numeric_score,developmental_level=EXCLUDED.developmental_level,score_state=EXCLUDED.score_state,status='DRAFT',entered_by=auth.uid(),updated_at=now();
    v_count:=v_count+1;
  END LOOP;
  UPDATE assessment_batches SET status='DRAFT',updated_at=now() WHERE id=b.id;
  RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_save_assessment_scores(UUID,JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_generate_student_invoice(p_student_id UUID,p_session_id UUID,p_term_id UUID,p_due_date DATE DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE s students%ROWTYPE; v_total NUMERIC(12,2); v_invoice UUID; v_number TEXT;
BEGIN
  SELECT * INTO s FROM students WHERE id=p_student_id FOR UPDATE;
  IF NOT FOUND OR NOT upwa_has_permission('finance.manage',s.current_division_id) THEN RAISE EXCEPTION 'Finance permission required for this division'; END IF;
  IF NOT EXISTS (SELECT 1 FROM terms t WHERE t.id=p_term_id AND t.session_id=p_session_id) THEN RAISE EXCEPTION 'The selected term does not belong to the session'; END IF;
  IF EXISTS(SELECT 1 FROM invoices WHERE student_id=p_student_id AND session_id=p_session_id AND term_id=p_term_id) THEN RAISE EXCEPTION 'An invoice already exists for this student and period'; END IF;
  SELECT COALESCE(sum(fs.amount),0) INTO v_total FROM fee_schedules fs
    WHERE fs.division_id=s.current_division_id AND fs.session_id=p_session_id AND fs.term_id=p_term_id AND fs.is_active
      AND (fs.class_id IS NULL OR fs.class_id=s.current_class_id)
      AND fs.student_category IN ('ANY',s.student_category);
  IF v_total<=0 THEN RAISE EXCEPTION 'No active fee schedule is configured for this class and period'; END IF;
  v_number:='UPWA-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  INSERT INTO invoices(invoice_number,student_id,division_id,session_id,term_id,total_amount,amount_paid,status,due_date,student_category)
    VALUES(v_number,s.id,s.current_division_id,p_session_id,p_term_id,v_total,0,'UNPAID',p_due_date,s.student_category) RETURNING id INTO v_invoice;
  INSERT INTO finance_invoice_items(invoice_id,fee_code,description,quantity,unit_amount)
    SELECT v_invoice,fee_code,description,1,amount FROM fee_schedules fs
    WHERE fs.division_id=s.current_division_id AND fs.session_id=p_session_id AND fs.term_id=p_term_id AND fs.is_active
      AND (fs.class_id IS NULL OR fs.class_id=s.current_class_id) AND fs.student_category IN ('ANY',s.student_category);
  INSERT INTO finance_activity(division_id,actor_id,action,entity_type,entity_id,metadata)
    VALUES(s.current_division_id,auth.uid(),'INVOICE_CREATED','invoice',v_invoice,jsonb_build_object('amount',v_total,'session_id',p_session_id,'term_id',p_term_id));
  RETURN v_invoice;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_generate_student_invoice(UUID,UUID,UUID,DATE) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_record_paystack_verification(p_reference TEXT,p_event_reference TEXT,p_verified_amount NUMERIC,p_currency TEXT,p_provider_status TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE p payment_transactions%ROWTYPE; v_receipt UUID; v_invoice UUID; v_allocated NUMERIC;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  INSERT INTO gateway_webhook_events(provider,event_reference,payload)
    VALUES('PAYSTACK',p_event_reference,jsonb_build_object('reference',p_reference,'status',p_provider_status))
    ON CONFLICT(event_reference) DO NOTHING;
  IF NOT FOUND THEN SELECT id INTO v_receipt FROM finance_receipts fr JOIN payment_transactions t ON t.id=fr.payment_id WHERE t.external_reference=p_reference; RETURN v_receipt; END IF;
  SELECT * INTO p FROM payment_transactions WHERE external_reference=p_reference AND provider='PAYSTACK' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No matching Paystack payment intent'; END IF;
  IF p.status='VERIFIED' THEN RETURN (SELECT id FROM finance_receipts WHERE payment_id=p.id); END IF;
  IF upper(p_provider_status)<>'SUCCESS' OR p_verified_amount<>p.amount OR upper(p_currency)<>p.currency THEN RAISE EXCEPTION 'Paystack verification does not match the recorded payment intent'; END IF;
  UPDATE payment_transactions SET status='VERIFIED',provider_status='success',verified_at=now(),settlement_reference=p_reference WHERE id=p.id;
  v_invoice:=NULLIF(p.metadata->>'invoice_id','')::UUID;
  IF v_invoice IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM invoices WHERE id=v_invoice AND student_id=p.student_id AND division_id=p.division_id) THEN RAISE EXCEPTION 'Payment invoice does not match the pupil'; END IF;
    SELECT GREATEST(i.total_amount-COALESCE((SELECT sum(pa.amount) FROM payment_allocations pa JOIN payment_transactions t ON t.id=pa.payment_id AND t.status='VERIFIED' WHERE pa.invoice_id=i.id),0),0) INTO v_allocated FROM invoices i WHERE i.id=v_invoice FOR UPDATE;
    v_allocated:=LEAST(p.amount,v_allocated);
    IF v_allocated>0 THEN
      INSERT INTO payment_allocations(payment_id,invoice_id,amount) VALUES(p.id,v_invoice,v_allocated) ON CONFLICT(payment_id,invoice_id) DO NOTHING;
      UPDATE invoices SET amount_paid=LEAST(total_amount,amount_paid+v_allocated),status=CASE WHEN amount_paid+v_allocated>=total_amount THEN 'PAID' WHEN amount_paid+v_allocated>0 THEN 'PARTIAL' ELSE status END WHERE id=v_invoice;
    END IF;
  END IF;
  INSERT INTO finance_receipts(payment_id,receipt_number) VALUES(p.id,'UPWA-R-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))) RETURNING id INTO v_receipt;
  INSERT INTO finance_activity(division_id,action,entity_type,entity_id,metadata) VALUES(p.division_id,'PAYMENT_VERIFIED','payment',p.id,jsonb_build_object('provider','PAYSTACK','amount',p.amount));
  RETURN v_receipt;
END; $$;
REVOKE ALL ON FUNCTION upwa_record_paystack_verification(TEXT,TEXT,NUMERIC,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION upwa_record_paystack_verification(TEXT,TEXT,NUMERIC,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION upwa_approve_expense(p_expense_id UUID,p_decision TEXT,p_note TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE e finance_expenses%ROWTYPE; v_next TEXT; v_ledger UUID;
BEGIN
  SELECT * INTO e FROM finance_expenses WHERE id=p_expense_id FOR UPDATE;
  IF NOT FOUND OR NOT upwa_has_permission('finance.expense_approve',e.division_id) OR e.requestor_id=auth.uid() THEN RAISE EXCEPTION 'Independent division approver required'; END IF;
  IF p_decision='APPROVE' AND e.status IN ('SUBMITTED','UNDER_REVIEW') THEN
    v_next:='APPROVED';
    INSERT INTO ledger_entries(division_id,entry_type,category,amount,reference_code,approved_by)
      VALUES(e.division_id,'EXPENSE',e.category,e.amount,'EXP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),auth.uid()) RETURNING id INTO v_ledger;
    UPDATE finance_expenses SET status='APPROVED',approved_by=auth.uid(),approved_at=now(),ledger_entry_id=v_ledger WHERE id=e.id;
  ELSIF p_decision='REJECT' AND e.status IN ('SUBMITTED','UNDER_REVIEW') THEN
    v_next:='REJECTED'; UPDATE finance_expenses SET status=v_next,approved_by=auth.uid(),approved_at=now() WHERE id=e.id;
  ELSIF p_decision='MARK_PAID' AND e.status='APPROVED' AND length(trim(COALESCE(p_note,'')))>=4 THEN
    v_next:='PAID'; UPDATE finance_expenses SET status=v_next,payment_reference=p_note,paid_by=auth.uid(),paid_at=now() WHERE id=e.id;
  ELSE RAISE EXCEPTION 'Invalid expense workflow transition'; END IF;
  INSERT INTO finance_expense_approvals(expense_id,actor_id,action,note) VALUES(e.id,auth.uid(),v_next, p_note);
  INSERT INTO finance_activity(division_id,actor_id,action,entity_type,entity_id,metadata) VALUES(e.division_id,auth.uid(),'EXPENSE_'||v_next,'expense',e.id,jsonb_build_object('amount',e.amount,'category',e.category));
  RETURN v_next;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_approve_expense(UUID,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_finance_summary(p_division_id UUID DEFAULT NULL, p_from DATE DEFAULT NULL, p_to DATE DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_result JSONB;
BEGIN
  IF NOT (upwa_has_permission('executive.read') OR upwa_has_permission('finance.read', p_division_id)) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT jsonb_build_object(
    'billed', COALESCE((SELECT sum(i.total_amount) FROM invoices i WHERE (p_division_id IS NULL OR i.division_id=p_division_id) AND (p_from IS NULL OR i.created_at::date >= p_from) AND (p_to IS NULL OR i.created_at::date <= p_to)),0),
    'collected', COALESCE((SELECT sum(p.amount) FROM payment_transactions p WHERE p.status='VERIFIED' AND (p_division_id IS NULL OR p.division_id=p_division_id) AND (p_from IS NULL OR p.verified_at::date >= p_from) AND (p_to IS NULL OR p.verified_at::date <= p_to)),0),
    'unpaid', COALESCE((SELECT sum(GREATEST(i.total_amount - COALESCE(x.paid,0),0)) FROM invoices i LEFT JOIN LATERAL (SELECT sum(pa.amount) paid FROM payment_allocations pa JOIN payment_transactions p ON p.id=pa.payment_id AND p.status='VERIFIED' WHERE pa.invoice_id=i.id) x ON true WHERE (p_division_id IS NULL OR i.division_id=p_division_id)),0),
    'nonTuitionIncome', COALESCE((SELECT sum(le.amount) FROM ledger_entries le WHERE le.entry_type='INCOME' AND (p_division_id IS NULL OR le.division_id=p_division_id) AND (p_from IS NULL OR le.posted_at::date >= p_from) AND (p_to IS NULL OR le.posted_at::date <= p_to)),0),
    'expensesApproved', COALESCE((SELECT sum(e.amount) FROM finance_expenses e WHERE e.status IN ('APPROVED','PAID') AND (p_division_id IS NULL OR e.division_id=p_division_id) AND (p_from IS NULL OR e.expense_date >= p_from) AND (p_to IS NULL OR e.expense_date <= p_to)),0),
    'expensesPaid', COALESCE((SELECT sum(e.amount) FROM finance_expenses e WHERE e.status='PAID' AND (p_division_id IS NULL OR e.division_id=p_division_id) AND (p_from IS NULL OR e.expense_date >= p_from) AND (p_to IS NULL OR e.expense_date <= p_to)),0),
    'netCashMovement', COALESCE((SELECT sum(p.amount) FROM payment_transactions p WHERE p.status='VERIFIED' AND (p_division_id IS NULL OR p.division_id=p_division_id) AND (p_from IS NULL OR p.verified_at::date >= p_from) AND (p_to IS NULL OR p.verified_at::date <= p_to)),0) - COALESCE((SELECT sum(e.amount) FROM finance_expenses e WHERE e.status='PAID' AND (p_division_id IS NULL OR e.division_id=p_division_id) AND (p_from IS NULL OR e.expense_date >= p_from) AND (p_to IS NULL OR e.expense_date <= p_to)),0),
    'reconciledCash', (SELECT r.closing_balance FROM bank_reconciliations r WHERE r.status='RECONCILED' AND (p_division_id IS NULL OR r.division_id=p_division_id) ORDER BY r.period_end DESC, r.reconciled_at DESC LIMIT 1),
    'activeStudents', (SELECT count(*) FROM students s WHERE s.status='ACTIVE' AND (p_division_id IS NULL OR s.current_division_id=p_division_id)),
    'staffCount', (SELECT count(*) FROM staff_profiles sp WHERE sp.employment_status='ACTIVE' AND (p_division_id IS NULL OR sp.division_id=p_division_id)),
    'submittedAdmissions', (SELECT count(*) FROM admission_applications a WHERE a.status='SUBMITTED' AND (p_division_id IS NULL OR a.division_id=p_division_id)),
    'publishedScoreBatches', (SELECT count(*) FROM assessment_batches b WHERE b.status='PUBLISHED' AND (p_division_id IS NULL OR b.division_id=p_division_id))
  ) INTO v_result;
  RETURN v_result;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_finance_summary(UUID,DATE,DATE) TO authenticated;

-- Direct browser updates must not bypass score-state transitions or payment verification RPCs.
REVOKE INSERT, UPDATE, DELETE ON assessment_scores FROM anon, authenticated;
DROP POLICY IF EXISTS payment_transactions_finance_manage ON payment_transactions;
DROP POLICY IF EXISTS payment_transactions_scoped_read ON payment_transactions;
CREATE POLICY payment_transactions_scoped_read ON payment_transactions FOR SELECT TO authenticated USING (
  upwa_has_permission('finance.read', division_id) OR upwa_is_guardian_of(student_id)
);
CREATE POLICY payment_transactions_pending_insert ON payment_transactions FOR INSERT TO authenticated WITH CHECK (
  upwa_has_permission('finance.manage', division_id) AND status IN ('PENDING','EVIDENCE_SUBMITTED') AND verified_at IS NULL
);
REVOKE UPDATE, DELETE ON payment_transactions FROM anon, authenticated;
GRANT SELECT, INSERT ON payment_transactions TO authenticated;

DROP POLICY IF EXISTS payment_evidence_scoped_read ON payment_evidence;
CREATE POLICY payment_evidence_scoped_read ON payment_evidence FOR SELECT TO authenticated USING (
  submitted_by = auth.uid() OR EXISTS(SELECT 1 FROM payment_transactions p WHERE p.id=payment_id AND upwa_has_permission('finance.read',p.division_id))
);
CREATE POLICY payment_evidence_submit ON payment_evidence FOR INSERT TO authenticated WITH CHECK (
  submitted_by=auth.uid() AND EXISTS(SELECT 1 FROM payment_transactions p WHERE p.id=payment_id AND p.status IN ('PENDING','EVIDENCE_SUBMITTED') AND p.provider='BANK_TRANSFER' AND (upwa_is_guardian_of(p.student_id) OR upwa_has_permission('finance.manage',p.division_id)))
);
GRANT INSERT ON payment_evidence TO authenticated;

CREATE OR REPLACE FUNCTION upwa_review_manual_payment(p_payment_id UUID,p_approve BOOLEAN,p_note TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE p payment_transactions%ROWTYPE; v_invoice UUID; v_new TEXT; v_allocated NUMERIC;
BEGIN
  SELECT * INTO p FROM payment_transactions WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND OR NOT upwa_has_permission('finance.manage',p.division_id) OR p.provider NOT IN ('BANK_TRANSFER','CASH','POS') OR p.created_by=auth.uid() THEN RAISE EXCEPTION 'Independent finance reviewer required'; END IF;
  IF p.status NOT IN ('PENDING','EVIDENCE_SUBMITTED') THEN RAISE EXCEPTION 'Payment is not awaiting verification'; END IF;
  IF p.provider='BANK_TRANSFER' AND NOT EXISTS(SELECT 1 FROM payment_evidence WHERE payment_id=p.id) THEN RAISE EXCEPTION 'Bank transfer evidence is required before review'; END IF;
  IF p_approve THEN
    UPDATE payment_transactions SET status='VERIFIED',verified_at=now(),verified_by=auth.uid(),provider_status='MANUALLY_VERIFIED' WHERE id=p.id;
    v_new:='VERIFIED';
    v_invoice:=NULLIF(p.metadata->>'invoice_id','')::UUID;
    IF v_invoice IS NOT NULL THEN
      SELECT GREATEST(i.total_amount-COALESCE((SELECT sum(pa.amount) FROM payment_allocations pa JOIN payment_transactions t ON t.id=pa.payment_id AND t.status='VERIFIED' WHERE pa.invoice_id=i.id),0),0) INTO v_allocated FROM invoices i WHERE i.id=v_invoice AND i.student_id=p.student_id AND i.division_id=p.division_id FOR UPDATE;
      v_allocated:=LEAST(p.amount,COALESCE(v_allocated,0));
      IF v_allocated>0 THEN
        INSERT INTO payment_allocations(payment_id,invoice_id,amount,allocated_by) VALUES(p.id,v_invoice,v_allocated,auth.uid());
        UPDATE invoices SET amount_paid=LEAST(total_amount,amount_paid+v_allocated),status=CASE WHEN amount_paid+v_allocated>=total_amount THEN 'PAID' WHEN amount_paid+v_allocated>0 THEN 'PARTIAL' ELSE status END WHERE id=v_invoice;
      END IF;
    END IF;
    INSERT INTO finance_receipts(payment_id,receipt_number,issued_by) VALUES(p.id,'UPWA-R-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),auth.uid());
  ELSE
    UPDATE payment_transactions SET status='REJECTED',provider_status=left(COALESCE(p_note,'Rejected'),200) WHERE id=p.id;
    v_new:='REJECTED';
  END IF;
  INSERT INTO finance_activity(division_id,actor_id,action,entity_type,entity_id,metadata) VALUES(p.division_id,auth.uid(),'MANUAL_PAYMENT_'||v_new,'payment',p.id,jsonb_build_object('provider',p.provider,'amount',p.amount,'note',left(COALESCE(p_note,''),500)));
  RETURN v_new;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_review_manual_payment(UUID,BOOLEAN,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_transition_assessment_batch(p_batch_id UUID,p_action TEXT,p_note TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_batch assessment_batches%ROWTYPE; v_next TEXT;
BEGIN
  SELECT * INTO v_batch FROM assessment_batches WHERE id=p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment batch not found'; END IF;
  IF p_action='SUBMIT' AND upwa_can_manage_assessment(v_batch.class_id,v_batch.subject_id) AND v_batch.status='DRAFT' THEN v_next:='SUBMITTED';
  ELSIF p_action='REVIEW' AND upwa_has_permission('results.review',v_batch.division_id) AND v_batch.status='SUBMITTED' AND v_batch.submitted_by IS DISTINCT FROM auth.uid() THEN v_next:='REVIEWED';
  ELSIF p_action='APPROVE' AND upwa_has_permission('results.publish',v_batch.division_id) AND v_batch.status='REVIEWED' AND v_batch.reviewed_by IS DISTINCT FROM auth.uid() THEN v_next:='APPROVED';
  ELSIF p_action='PUBLISH' AND upwa_has_permission('results.publish',v_batch.division_id) AND v_batch.status='APPROVED' AND v_batch.approved_by IS DISTINCT FROM auth.uid() THEN v_next:='PUBLISHED';
  ELSIF p_action='REQUEST_CORRECTION' AND upwa_has_permission('results.review',v_batch.division_id) AND v_batch.status IN ('SUBMITTED','REVIEWED','APPROVED','PUBLISHED') AND length(trim(COALESCE(p_note,'')))>=5 THEN v_next:='CORRECTION_REQUESTED';
  ELSIF p_action='APPROVE_CORRECTION' AND upwa_has_permission('results.publish',v_batch.division_id) AND v_batch.status='CORRECTION_REQUESTED' THEN
    UPDATE assessment_scores SET status='DRAFT',published_at=NULL,approved_by=NULL,reviewed_by=NULL WHERE class_id=v_batch.class_id AND subject_id=v_batch.subject_id AND session_id=v_batch.session_id AND term_id=v_batch.term_id;
    v_next:='DRAFT';
  ELSE RAISE EXCEPTION 'Transition is not permitted from the current status'; END IF;
  IF p_action='PUBLISH' THEN
    IF EXISTS(SELECT 1 FROM assessment_scores s WHERE s.class_id=v_batch.class_id AND s.subject_id=v_batch.subject_id AND s.session_id=v_batch.session_id AND s.term_id=v_batch.term_id AND s.status<>'APPROVED' AND s.status<>'PUBLISHED') THEN RAISE EXCEPTION 'All scores must be approved before publication'; END IF;
    UPDATE assessment_scores SET status='PUBLISHED', published_at=now() WHERE class_id=v_batch.class_id AND subject_id=v_batch.subject_id AND session_id=v_batch.session_id AND term_id=v_batch.term_id;
  ELSIF p_action='APPROVE' THEN UPDATE assessment_scores SET status='APPROVED', approved_by=auth.uid() WHERE class_id=v_batch.class_id AND subject_id=v_batch.subject_id AND session_id=v_batch.session_id AND term_id=v_batch.term_id AND status='REVIEWED';
  ELSIF p_action='REVIEW' THEN UPDATE assessment_scores SET status='REVIEWED', reviewed_by=auth.uid() WHERE class_id=v_batch.class_id AND subject_id=v_batch.subject_id AND session_id=v_batch.session_id AND term_id=v_batch.term_id AND status='SUBMITTED';
  ELSIF p_action='SUBMIT' THEN UPDATE assessment_scores SET status='SUBMITTED' WHERE class_id=v_batch.class_id AND subject_id=v_batch.subject_id AND session_id=v_batch.session_id AND term_id=v_batch.term_id AND status='DRAFT';
  END IF;
  UPDATE assessment_batches SET status=v_next, updated_at=now(), version=CASE WHEN p_action='APPROVE_CORRECTION' THEN version+1 ELSE version END,
    locked_at=CASE WHEN p_action IN ('SUBMIT','APPROVE','PUBLISH') THEN now() ELSE locked_at END,
    submitted_by=CASE WHEN p_action='SUBMIT' THEN auth.uid() ELSE submitted_by END, submitted_at=CASE WHEN p_action='SUBMIT' THEN now() ELSE submitted_at END,
    reviewed_by=CASE WHEN p_action='REVIEW' THEN auth.uid() ELSE reviewed_by END, reviewed_at=CASE WHEN p_action='REVIEW' THEN now() ELSE reviewed_at END,
    approved_by=CASE WHEN p_action='APPROVE' THEN auth.uid() ELSE approved_by END, approved_at=CASE WHEN p_action='APPROVE' THEN now() ELSE approved_at END,
    published_by=CASE WHEN p_action='PUBLISH' THEN auth.uid() ELSE published_by END, published_at=CASE WHEN p_action='PUBLISH' THEN now() ELSE published_at END,
    correction_note=CASE WHEN p_action='REQUEST_CORRECTION' THEN p_note ELSE correction_note END
  WHERE id=p_batch_id;
  INSERT INTO finance_activity(division_id,actor_id,action,entity_type,entity_id,metadata) VALUES(v_batch.division_id,auth.uid(),'ASSESSMENT_'||p_action,'assessment_batch',v_batch.id,jsonb_build_object('status',v_next));
  RETURN v_next;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_transition_assessment_batch(UUID,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_issue_report_card(p_student_id UUID,p_session_id UUID,p_term_id UUID,p_document_reference TEXT,p_version INTEGER,p_snapshot JSONB,p_signature TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE s students%ROWTYPE; v_id UUID; v_division_name TEXT; v_issuer TEXT:='UPWA International Schools'; v_version INTEGER;
BEGIN
  SELECT * INTO s FROM students WHERE id=p_student_id;
  IF NOT FOUND OR NOT upwa_has_permission('results.publish',s.current_division_id) THEN RAISE EXCEPTION 'Authorised result publisher required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM assessment_scores WHERE student_id=p_student_id AND session_id=p_session_id AND term_id=p_term_id AND status='PUBLISHED') THEN RAISE EXCEPTION 'Only published results can be issued'; END IF;
  SELECT COALESCE(max(version),0)+1 INTO v_version FROM report_verification WHERE student_id=p_student_id AND session_id=p_session_id AND term_id=p_term_id;
  IF p_version<>v_version OR length(trim(p_document_reference))<12 OR length(trim(p_signature))<32 THEN RAISE EXCEPTION 'Invalid report version or signature'; END IF;
  SELECT name INTO v_division_name FROM school_divisions WHERE id=s.current_division_id;
  v_issuer:=v_issuer||' · '||COALESCE(v_division_name,'');
  UPDATE report_verification SET status='SUPERSEDED' WHERE student_id=p_student_id AND session_id=p_session_id AND term_id=p_term_id AND status='VALID';
  INSERT INTO report_verification(document_reference,student_id,session_id,term_id,version,hmac_signature,status,division_id,issuer)
  VALUES(p_document_reference,p_student_id,p_session_id,p_term_id,p_version,p_signature,'VALID',s.current_division_id,v_issuer) RETURNING id INTO v_id;
  UPDATE report_verification SET superseded_by=v_id WHERE student_id=p_student_id AND session_id=p_session_id AND term_id=p_term_id AND status='SUPERSEDED' AND superseded_by IS NULL;
  INSERT INTO report_card_snapshots(verification_id,student_id,session_id,term_id,division_id,snapshot,issued_by)
  VALUES(v_id,p_student_id,p_session_id,p_term_id,s.current_division_id,p_snapshot,auth.uid());
  INSERT INTO finance_activity(division_id,actor_id,action,entity_type,entity_id,metadata)
  VALUES(s.current_division_id,auth.uid(),'REPORT_CARD_ISSUED','report_card',v_id,jsonb_build_object('version',p_version));
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_issue_report_card(UUID,UUID,UUID,TEXT,INTEGER,JSONB,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_executive_activity(p_division_id UUID DEFAULT NULL,p_limit INTEGER DEFAULT 50)
RETURNS TABLE(id UUID,action TEXT,entity_type TEXT,created_at TIMESTAMPTZ,actor_label TEXT,division_id UUID)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, auth AS $$
 SELECT a.id,a.action,a.entity_type,a.created_at,COALESCE(up.display_name,'Authorised staff'),a.division_id
 FROM finance_activity a LEFT JOIN user_profiles up ON up.user_id=a.actor_id
 WHERE upwa_has_permission('executive.read') AND (p_division_id IS NULL OR a.division_id=p_division_id)
 ORDER BY a.created_at DESC LIMIT LEAST(GREATEST(p_limit,1),100);
$$;
GRANT EXECUTE ON FUNCTION upwa_executive_activity(UUID,INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_audit_finance_expense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO finance_expense_approvals(expense_id,actor_id,action,note) VALUES(NEW.id,auth.uid(),'SUBMITTED','Expense submitted');
    INSERT INTO finance_activity(division_id,actor_id,action,entity_type,entity_id,metadata) VALUES(NEW.division_id,auth.uid(),'EXPENSE_SUBMITTED','expense',NEW.id,jsonb_build_object('amount',NEW.amount,'category',NEW.category));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO finance_expense_approvals(expense_id,actor_id,action,note)
    VALUES(NEW.id,COALESCE(NEW.paid_by,NEW.approved_by,auth.uid()),
      CASE NEW.status WHEN 'UNDER_REVIEW' THEN 'REVIEWED' WHEN 'VOID' THEN 'CORRECTED' ELSE NEW.status END,
      COALESCE(NEW.payment_reference,NEW.status));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_upwa_audit_finance_expense ON finance_expenses;
CREATE TRIGGER trg_upwa_audit_finance_expense AFTER INSERT OR UPDATE ON finance_expenses FOR EACH ROW EXECUTE FUNCTION upwa_audit_finance_expense();

-- Register activity from the privileged assessment state transition in the shared executive feed.

CREATE OR REPLACE FUNCTION upwa_create_payment_intent(p_invoice_id UUID,p_reference TEXT)
RETURNS TABLE(payment_id UUID,amount NUMERIC,currency CHAR(3))
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE i invoices%ROWTYPE; v_due NUMERIC; v_id UUID;
BEGIN
  SELECT * INTO i FROM invoices WHERE id=p_invoice_id;
  IF NOT FOUND OR NOT (upwa_has_permission('finance.manage',i.division_id) OR upwa_is_guardian_of(i.student_id)) THEN RAISE EXCEPTION 'Invoice is not available to this account'; END IF;
  SELECT i.total_amount-COALESCE(sum(pa.amount),0) INTO v_due FROM payment_allocations pa JOIN payment_transactions p ON p.id=pa.payment_id AND p.status='VERIFIED' WHERE pa.invoice_id=i.id;
  v_due:=GREATEST(COALESCE(v_due,i.total_amount),0);
  IF v_due<=0 THEN RAISE EXCEPTION 'Invoice is already fully settled'; END IF;
  INSERT INTO payment_transactions(division_id,student_id,provider,external_reference,amount,currency,status,metadata,created_by)
    VALUES(i.division_id,i.student_id,'PAYSTACK',p_reference,v_due,'NGN','PENDING',jsonb_build_object('invoice_id',i.id),auth.uid()) RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id,v_due,'NGN'::CHAR(3);
END; $$;
GRANT EXECUTE ON FUNCTION upwa_create_payment_intent(UUID,TEXT) TO authenticated;
