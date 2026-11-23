-- Executive briefing, private communications, bank-transfer operations,
-- safe pickup, and structured early-years care.

INSERT INTO permissions(code,description) VALUES
  ('communications.manage','Manage consented notification templates and delivery operations'),
  ('reports.read','Export approved operational reports within assigned division scope'),
  ('gate.audit','Review private pupil release and pickup-attempt logs')
ON CONFLICT(code) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_code)
SELECT r.id,p.code FROM roles r JOIN permissions p ON
  (r.code IN ('UPWA_PRESIDENT','EXECUTIVE_BOARD') AND p.code='reports.read') OR
  (r.code IN ('BURSAR_ACCOUNTANT','PRIMARY_HEAD_TEACHER','SECONDARY_PRINCIPAL','EXAMINATIONS_OFFICER','ADMISSIONS_OFFICER') AND p.code='reports.read') OR
  (r.code IN ('PRIMARY_HEAD_TEACHER','SECONDARY_PRINCIPAL','UPWA_PRESIDENT') AND p.code='communications.manage') OR
  (r.code='GATE_SECURITY' AND p.code='gate.audit')
ON CONFLICT DO NOTHING;

-- Weekly is the default digest. Recipients are authenticated, email-confirmed
-- executive users; arbitrary recipient addresses are never accepted.
CREATE TABLE IF NOT EXISTS executive_brief_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  division_id UUID REFERENCES school_divisions(id),
  frequency TEXT NOT NULL DEFAULT 'WEEKLY' CHECK(frequency IN ('DAILY','WEEKLY','MONTHLY')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_period_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id,recipient_user_id,division_id)
);
CREATE TABLE IF NOT EXISTS executive_brief_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES executive_brief_schedules(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING' CHECK(status IN ('PROCESSING','SENT','FAILED')),
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  last_error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(schedule_id,period_key)
);
CREATE INDEX IF NOT EXISTS executive_brief_due_idx ON executive_brief_schedules(next_run_at) WHERE is_active;
CREATE INDEX IF NOT EXISTS executive_brief_retry_idx ON executive_brief_runs(started_at) WHERE status='FAILED';
ALTER TABLE executive_brief_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive_brief_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY brief_schedule_self_read ON executive_brief_schedules FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE POLICY brief_run_self_read ON executive_brief_runs FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM executive_brief_schedules s WHERE s.id=schedule_id AND s.owner_id=auth.uid()));
GRANT SELECT ON executive_brief_schedules,executive_brief_runs TO authenticated;

CREATE OR REPLACE FUNCTION upwa_save_brief_schedule(p_frequency TEXT,p_division_id UUID DEFAULT NULL,p_active BOOLEAN DEFAULT TRUE)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_email_confirmed TIMESTAMPTZ; v_id UUID;
BEGIN
  IF p_frequency NOT IN ('DAILY','WEEKLY','MONTHLY') OR NOT upwa_has_permission('executive.read',p_division_id) THEN RAISE EXCEPTION 'Executive access and a supported frequency are required'; END IF;
  SELECT email_confirmed_at INTO v_email_confirmed FROM auth.users WHERE id=auth.uid();
  IF v_email_confirmed IS NULL THEN RAISE EXCEPTION 'A verified email address is required for brief delivery'; END IF;
  INSERT INTO executive_brief_schedules(owner_id,recipient_user_id,division_id,frequency,is_active,next_run_at,updated_at)
    VALUES(auth.uid(),auth.uid(),p_division_id,p_frequency,p_active,now(),now())
    ON CONFLICT(owner_id,recipient_user_id,division_id) DO UPDATE SET frequency=EXCLUDED.frequency,is_active=EXCLUDED.is_active,next_run_at=now(),updated_at=now()
    RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_save_brief_schedule(TEXT,UUID,BOOLEAN) TO authenticated;

-- Preferences are per linked child; a guardian must opt in to each channel.
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS communication_preferences (
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK(event_type IN ('RESULT_PUBLISHED','PAYMENT_CONFIRMED','ABSENCE','ADMISSION_UPDATE','URGENT_NOTICE','CARE_UPDATE')),
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(guardian_id,student_id,event_type),
  FOREIGN KEY(student_id,guardian_id) REFERENCES student_guardians(student_id,guardian_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notification_templates (
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('EMAIL','SMS','WHATSAPP')),
  subject TEXT,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(event_type,channel)
);
INSERT INTO notification_templates(event_type,channel,subject,body) VALUES
 ('RESULT_PUBLISHED','EMAIL','UPWA school update','A new school update is available. Sign in to the UPWA portal to view it.'),
 ('PAYMENT_CONFIRMED','EMAIL','UPWA school update','A payment update is available. Sign in to the UPWA portal to view it.'),
 ('ABSENCE','EMAIL','UPWA school update','There is an attendance update. Sign in to the UPWA portal or contact the school.'),
 ('ADMISSION_UPDATE','EMAIL','UPWA school update','There is an admissions update. Sign in to the UPWA portal to view it.'),
 ('URGENT_NOTICE','EMAIL','Important UPWA school notice','There is an important school notice. Sign in to the UPWA portal to view it.'),
 ('CARE_UPDATE','EMAIL','UPWA school update','A care update is available. Sign in to the UPWA portal to view it.'),
 ('RESULT_PUBLISHED','SMS',NULL,'UPWA: A school update is available. Sign in to the parent portal.'),
 ('PAYMENT_CONFIRMED','SMS',NULL,'UPWA: A payment update is available. Sign in to the parent portal.'),
 ('ABSENCE','SMS',NULL,'UPWA: There is an attendance update. Please sign in or contact the school.'),
 ('ADMISSION_UPDATE','SMS',NULL,'UPWA: An admissions update is available. Sign in to the portal.'),
 ('URGENT_NOTICE','SMS',NULL,'UPWA: An important school notice is available. Sign in to the portal.'),
 ('CARE_UPDATE','SMS',NULL,'UPWA: A care update is available. Sign in to the parent portal.'),
 ('RESULT_PUBLISHED','WHATSAPP',NULL,'UPWA: A school update is available. Sign in to the parent portal.'),
 ('PAYMENT_CONFIRMED','WHATSAPP',NULL,'UPWA: A payment update is available. Sign in to the parent portal.'),
 ('ABSENCE','WHATSAPP',NULL,'UPWA: There is an attendance update. Please sign in or contact the school.'),
 ('ADMISSION_UPDATE','WHATSAPP',NULL,'UPWA: An admissions update is available. Sign in to the portal.'),
 ('URGENT_NOTICE','WHATSAPP',NULL,'UPWA: An important school notice is available. Sign in to the portal.'),
 ('CARE_UPDATE','WHATSAPP',NULL,'UPWA: A care update is available. Sign in to the parent portal.')
ON CONFLICT(event_type,channel) DO NOTHING;
CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES guardians(id),
  student_id UUID NOT NULL REFERENCES students(id),
  event_type TEXT NOT NULL,
  event_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('EMAIL','SMS','WHATSAPP')),
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENDING','SENT','FAILED','CANCELLED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_message_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  UNIQUE(event_key,guardian_id,channel)
);
CREATE INDEX IF NOT EXISTS notification_due_idx ON notification_outbox(next_attempt_at) WHERE status IN ('PENDING','FAILED');
CREATE TABLE IF NOT EXISTS notification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notification_outbox(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  provider TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  provider_message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(notification_id,attempt_number)
);
ALTER TABLE communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY communication_preferences_guardian ON communication_preferences FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM guardians g WHERE g.id=guardian_id AND g.user_id=auth.uid())) WITH CHECK(EXISTS(SELECT 1 FROM guardians g WHERE g.id=guardian_id AND g.user_id=auth.uid()));
CREATE POLICY notification_templates_staff_read ON notification_templates FOR SELECT TO authenticated USING(upwa_has_permission('communications.manage'));
CREATE POLICY notification_outbox_scope_read ON notification_outbox FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM guardians g WHERE g.id=guardian_id AND g.user_id=auth.uid()) OR upwa_has_permission('communications.manage'));
CREATE POLICY notification_attempts_scope_read ON notification_attempts FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM notification_outbox n JOIN guardians g ON g.id=n.guardian_id WHERE n.id=notification_id AND (g.user_id=auth.uid() OR upwa_has_permission('communications.manage'))));
GRANT SELECT,INSERT,UPDATE ON communication_preferences TO authenticated;
GRANT SELECT ON notification_templates,notification_outbox,notification_attempts TO authenticated;

CREATE OR REPLACE FUNCTION upwa_enqueue_parent_notice(p_student_id UUID,p_event_type TEXT,p_event_key TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE g RECORD; t RECORD; v_added INTEGER:=0; v_recipient TEXT;
BEGIN
  IF p_event_type NOT IN ('RESULT_PUBLISHED','PAYMENT_CONFIRMED','ABSENCE','ADMISSION_UPDATE','URGENT_NOTICE','CARE_UPDATE') THEN RAISE EXCEPTION 'Unsupported notification type'; END IF;
  FOR g IN SELECT sg.guardian_id,gu.email,gu.phone,gu.email_verified_at,gu.phone_verified_at,cp.email_enabled,cp.sms_enabled,cp.whatsapp_enabled
    FROM student_guardians sg JOIN guardians gu ON gu.id=sg.guardian_id
    LEFT JOIN communication_preferences cp ON cp.guardian_id=sg.guardian_id AND cp.student_id=sg.student_id AND cp.event_type=p_event_type
    WHERE sg.student_id=p_student_id LOOP
    FOR t IN SELECT nt.channel,nt.subject,nt.body FROM notification_templates nt WHERE nt.event_type=p_event_type AND nt.is_active LOOP
      v_recipient:=NULL;
      IF t.channel='EMAIL' AND g.email_enabled AND g.email_verified_at IS NOT NULL THEN v_recipient:=g.email;
      ELSIF t.channel='SMS' AND g.sms_enabled AND g.phone_verified_at IS NOT NULL THEN v_recipient:=g.phone;
      ELSIF t.channel='WHATSAPP' AND g.whatsapp_enabled AND g.phone_verified_at IS NOT NULL THEN v_recipient:=g.phone; END IF;
      IF v_recipient IS NOT NULL AND length(v_recipient)>3 THEN
        INSERT INTO notification_outbox(guardian_id,student_id,event_type,event_key,channel,recipient,subject,body,next_attempt_at)
          VALUES(g.guardian_id,p_student_id,p_event_type,p_event_key,t.channel,v_recipient,t.subject,t.body,
            CASE WHEN p_event_type='ABSENCE' THEN now()+make_interval(mins=>COALESCE((SELECT ads.absence_notification_delay_minutes FROM academic_division_settings ads JOIN students st ON st.current_division_id=ads.division_id WHERE st.id=p_student_id),30)) ELSE now() END)
          ON CONFLICT(event_key,guardian_id,channel) DO NOTHING;
        IF FOUND THEN v_added:=v_added+1; END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_added;
END; $$;
REVOKE ALL ON FUNCTION upwa_enqueue_parent_notice(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION upwa_enqueue_parent_notice(UUID,TEXT,TEXT) TO service_role;

-- U&C Microfinance Bank is the school's designated collection bank. Account
-- details must be entered and approved by finance; no number is invented here.
CREATE TABLE IF NOT EXISTS cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID REFERENCES school_divisions(id),
  institution_name TEXT NOT NULL DEFAULT 'U&C Microfinance Bank',
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL CHECK(account_number ~ '^[0-9]{8,20}$'),
  bank_branch TEXT,
  account_purpose TEXT NOT NULL CHECK(account_purpose IN ('SCHOOL_FEES','DONATIONS','OPERATIONS')),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK((is_active AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR NOT is_active)
);
CREATE INDEX IF NOT EXISTS cash_accounts_active_idx ON cash_accounts(account_purpose,division_id) WHERE is_active;
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_accounts_finance_read ON cash_accounts FOR SELECT TO authenticated USING(upwa_has_permission('finance.read',division_id) OR upwa_has_permission('finance.manage',division_id));
CREATE POLICY cash_accounts_manage ON cash_accounts FOR ALL TO authenticated USING(upwa_has_permission('finance.manage',division_id)) WITH CHECK(upwa_has_permission('finance.manage',division_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON cash_accounts TO authenticated;

CREATE OR REPLACE FUNCTION upwa_get_guardian_bank_instructions(p_invoice_id UUID)
RETURNS TABLE(payment_id UUID,amount NUMERIC,account_name TEXT,account_number TEXT,bank_name TEXT,bank_branch TEXT,reference TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE i invoices%ROWTYPE; v_amount NUMERIC; v_payment UUID; v_reference TEXT; a RECORD;
BEGIN
  SELECT * INTO i FROM invoices WHERE id=p_invoice_id;
  IF NOT FOUND OR NOT upwa_is_guardian_of(i.student_id) THEN RAISE EXCEPTION 'This invoice is not linked to your family account'; END IF;
  SELECT GREATEST(i.total_amount-COALESCE(sum(pa.amount),0),0) INTO v_amount FROM payment_allocations pa JOIN payment_transactions p ON p.id=pa.payment_id AND p.status='VERIFIED' WHERE pa.invoice_id=i.id;
  v_amount:=COALESCE(v_amount,i.total_amount);
  SELECT * INTO a FROM cash_accounts WHERE account_purpose='SCHOOL_FEES' AND is_active AND (division_id=i.division_id OR division_id IS NULL) ORDER BY (division_id IS NULL),created_at DESC LIMIT 1;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Approved school bank instructions are not yet configured'; END IF;
  IF v_amount<=0 THEN RAISE EXCEPTION 'The invoice is already settled'; END IF;
  v_reference:='UPWA-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  INSERT INTO payment_transactions(division_id,student_id,provider,external_reference,amount,currency,status,metadata,created_by)
    VALUES(i.division_id,i.student_id,'BANK_TRANSFER',v_reference,v_amount,'NGN','PENDING',jsonb_build_object('invoice_id',i.id,'account_id',a.id,'channel','BANK_TRANSFER'),auth.uid()) RETURNING id INTO v_payment;
  RETURN QUERY SELECT v_payment,v_amount,a.account_name,a.account_number,a.institution_name,a.bank_branch,v_reference;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_get_guardian_bank_instructions(UUID) TO authenticated;

-- All bank-transfer evidence is private and staff review is independent of the submitter.
ALTER TABLE payment_evidence ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);
ALTER TABLE payment_evidence ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION upwa_review_manual_payment(p_payment_id UUID,p_approve BOOLEAN,p_note TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE p payment_transactions%ROWTYPE; v_invoice UUID; v_amount NUMERIC;
BEGIN
  SELECT * INTO p FROM payment_transactions WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND OR NOT upwa_has_permission('finance.manage',p.division_id) OR p.created_by=auth.uid() OR p.provider<>'BANK_TRANSFER' THEN RAISE EXCEPTION 'Independent division finance reviewer required'; END IF;
  IF p.status NOT IN ('PENDING','EVIDENCE_SUBMITTED') OR NOT EXISTS(SELECT 1 FROM payment_evidence WHERE payment_id=p.id) THEN RAISE EXCEPTION 'Payment evidence is missing or already reviewed'; END IF;
  IF p_approve AND length(trim(COALESCE(p_note,'')))<4 THEN RAISE EXCEPTION 'A bank statement transaction reference is required'; END IF;
  IF NOT p_approve THEN
    UPDATE payment_transactions SET status='REJECTED',provider_status=left(COALESCE(p_note,'Evidence rejected'),200) WHERE id=p.id;
    INSERT INTO finance_activity(division_id,actor_id,action,entity_type,entity_id,metadata) VALUES(p.division_id,auth.uid(),'BANK_TRANSFER_REJECTED','payment',p.id,jsonb_build_object('note',left(COALESCE(p_note,''),500)));
    RETURN 'REJECTED';
  END IF;
  UPDATE payment_transactions SET status='VERIFIED',verified_at=now(),verified_by=auth.uid(),provider_status='BANK_COUNTER_VERIFIED',settlement_reference=left(trim(p_note),120) WHERE id=p.id;
  v_invoice:=NULLIF(p.metadata->>'invoice_id','')::UUID;
  SELECT GREATEST(i.total_amount-COALESCE((SELECT sum(pa.amount) FROM payment_allocations pa JOIN payment_transactions t ON t.id=pa.payment_id AND t.status='VERIFIED' WHERE pa.invoice_id=i.id),0),0)
    INTO v_amount FROM invoices i WHERE i.id=v_invoice AND i.student_id=p.student_id AND i.division_id=p.division_id FOR UPDATE;
  v_amount:=LEAST(p.amount,COALESCE(v_amount,0));
  IF v_amount<=0 THEN RAISE EXCEPTION 'No invoice balance remains to allocate'; END IF;
  INSERT INTO payment_allocations(payment_id,invoice_id,amount,allocated_by) VALUES(p.id,v_invoice,v_amount,auth.uid());
  UPDATE invoices SET amount_paid=LEAST(total_amount,amount_paid+v_amount),status=CASE WHEN amount_paid+v_amount>=total_amount THEN 'PAID' ELSE 'PARTIAL' END WHERE id=v_invoice;
  INSERT INTO finance_receipts(payment_id,receipt_number,issued_by) VALUES(p.id,'UPWA-R-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),auth.uid());
  UPDATE payment_evidence SET verified_by=auth.uid(),verified_at=now() WHERE payment_id=p.id;
  INSERT INTO finance_activity(division_id,actor_id,action,entity_type,entity_id,metadata) VALUES(p.division_id,auth.uid(),'BANK_TRANSFER_VERIFIED','payment',p.id,jsonb_build_object('amount',v_amount,'bank_account_id',p.metadata->>'account_id','settlement_reference',left(trim(p_note),120)));
  PERFORM upwa_enqueue_parent_notice(p.student_id,'PAYMENT_CONFIRMED',p.id::text);
  RETURN 'VERIFIED';
END; $$;
GRANT EXECUTE ON FUNCTION upwa_review_manual_payment(UUID,BOOLEAN,TEXT) TO authenticated;

-- Parent authorisation requires an actual guardian link with pickup consent.
ALTER TABLE pickup_events ADD COLUMN IF NOT EXISTS exception_note TEXT;
ALTER TABLE pickup_events ADD COLUMN IF NOT EXISTS verified_person_name TEXT;
CREATE TABLE IF NOT EXISTS pickup_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  division_id UUID REFERENCES school_divisions(id),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  presented_name TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('RELEASED','DENIED_NO_AUTHORIZATION','DENIED_EXPIRED','DENIED_ALREADY_RELEASED','SUSPICIOUS')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pickup_attempts_student_date_idx ON pickup_attempts(student_id,created_at DESC);
ALTER TABLE pickup_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY pickup_attempts_gate_read ON pickup_attempts FOR SELECT TO authenticated USING(upwa_has_permission('gate.audit',division_id) OR upwa_has_permission('pickup.manage',division_id));
GRANT SELECT ON pickup_attempts TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON pickup_authorisations,pickup_events,pickup_attempts FROM anon,authenticated;
GRANT SELECT ON pickup_authorisations,pickup_events TO authenticated;
GRANT SELECT,INSERT ON pickup_attempts TO authenticated;

CREATE OR REPLACE FUNCTION upwa_create_pickup_authorisation(p_student_id UUID,p_name TEXT,p_relationship TEXT,p_photo_path TEXT,p_expires_at TIMESTAMPTZ)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM student_guardians sg JOIN students s ON s.id=sg.student_id JOIN school_divisions d ON d.id=s.current_division_id
    WHERE sg.student_id=p_student_id AND sg.guardian_id IN (SELECT g.id FROM guardians g WHERE g.user_id=auth.uid()) AND sg.can_authorize_pickup AND d.code='PRIMARY_EARLY_YEARS') THEN
    RAISE EXCEPTION 'A pickup-authorised guardian of a Primary / Early Years pupil is required';
  END IF;
  IF length(trim(p_name))<2 OR length(trim(p_relationship))<2 OR p_expires_at<=now() OR p_expires_at>now()+interval '90 days' OR p_photo_path !~ ('^'||p_student_id::text||'/[A-Za-z0-9_-]+[.](jpg|jpeg|png)$') THEN RAISE EXCEPTION 'Valid pickup person name, photo and expiry are required'; END IF;
  INSERT INTO pickup_authorisations(student_id,collector_name,relationship,photo_storage_path,expires_at,is_active)
    VALUES(p_student_id,trim(p_name),trim(p_relationship),p_photo_path,p_expires_at,true) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_create_pickup_authorisation(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_gate_lookup(p_admission_number TEXT)
RETURNS TABLE(student_id UUID,admission_number TEXT,student_name TEXT,class_name TEXT,authorisation_id UUID,collector_name TEXT,relationship TEXT,photo_storage_path TEXT,expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_student students%ROWTYPE; v_division UUID;
BEGIN
  SELECT s.* INTO v_student FROM students s JOIN school_divisions d ON d.id=s.current_division_id
    WHERE s.admission_number=trim(p_admission_number) AND d.code='PRIMARY_EARLY_YEARS' AND s.status='ACTIVE';
  IF NOT FOUND OR NOT upwa_has_permission('pickup.manage',v_student.current_division_id) THEN RAISE EXCEPTION 'No authorised Primary pupil found for this gate account'; END IF;
  RETURN QUERY SELECT v_student.id,v_student.admission_number,concat_ws(' ',v_student.first_name,v_student.middle_name,v_student.last_name),c.name,pa.id,pa.collector_name,pa.relationship,pa.photo_storage_path,pa.expires_at
    FROM (SELECT 1) seed LEFT JOIN classes c ON c.id=v_student.current_class_id
      LEFT JOIN pickup_authorisations pa ON pa.student_id=v_student.id AND pa.is_active AND (pa.expires_at IS NULL OR pa.expires_at>now())
    ORDER BY pa.created_at DESC NULLS LAST;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_gate_lookup(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_gate_release(p_student_id UUID,p_authorisation_id UUID,p_presented_name TEXT,p_exception_note TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE s students%ROWTYPE; pa pickup_authorisations%ROWTYPE; v_date DATE:=current_date;
BEGIN
  SELECT * INTO s FROM students WHERE id=p_student_id FOR UPDATE;
  IF NOT FOUND OR NOT upwa_has_permission('pickup.manage',s.current_division_id) THEN RAISE EXCEPTION 'Gate release permission is required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM school_divisions d WHERE d.id=s.current_division_id AND d.code='PRIMARY_EARLY_YEARS') THEN RAISE EXCEPTION 'This gate workflow is limited to Primary / Early Years'; END IF;
  IF EXISTS(SELECT 1 FROM pickup_events WHERE student_id=s.id AND pickup_date=v_date) THEN
    INSERT INTO pickup_attempts(student_id,division_id,actor_id,presented_name,outcome,note) VALUES(s.id,s.current_division_id,auth.uid(),left(p_presented_name,120),'DENIED_ALREADY_RELEASED','Duplicate release attempt');
    RETURN 'DENIED_ALREADY_RELEASED';
  END IF;
  SELECT * INTO pa FROM pickup_authorisations WHERE id=p_authorisation_id AND student_id=s.id FOR UPDATE;
  IF NOT FOUND OR NOT pa.is_active THEN
    INSERT INTO pickup_attempts(student_id,division_id,actor_id,presented_name,outcome,note) VALUES(s.id,s.current_division_id,auth.uid(),left(p_presented_name,120),'DENIED_NO_AUTHORIZATION','No matching active authorisation');
    RETURN 'DENIED_NO_AUTHORIZATION';
  END IF;
  IF pa.expires_at IS NOT NULL AND pa.expires_at<=now() THEN
    INSERT INTO pickup_attempts(student_id,division_id,actor_id,presented_name,outcome,note) VALUES(s.id,s.current_division_id,auth.uid(),left(p_presented_name,120),'DENIED_EXPIRED','Authorisation expired');
    RETURN 'DENIED_EXPIRED';
  END IF;
  IF lower(trim(pa.collector_name))<>lower(trim(p_presented_name)) OR length(trim(COALESCE(p_exception_note,'')))>500 THEN
    INSERT INTO pickup_attempts(student_id,division_id,actor_id,presented_name,outcome,note) VALUES(s.id,s.current_division_id,auth.uid(),left(p_presented_name,120),'SUSPICIOUS','Presented identity differs from the authorisation');
    RETURN 'SUSPICIOUS';
  END IF;
  INSERT INTO pickup_events(student_id,authorisation_id,pickup_date,released_by,verified_person_name,exception_note)
    VALUES(s.id,pa.id,v_date,auth.uid(),pa.collector_name,NULLIF(trim(p_exception_note),''));
  INSERT INTO pickup_attempts(student_id,division_id,actor_id,presented_name,outcome,note) VALUES(s.id,s.current_division_id,auth.uid(),pa.collector_name,'RELEASED',NULLIF(trim(p_exception_note),''));
  INSERT INTO audit_logs(actor_id,action,entity_table,entity_id,metadata) VALUES(auth.uid(),'CHILD_RELEASED','pickup_events',s.id::text,jsonb_build_object('authorisation_id',pa.id,'exception_note',NULLIF(p_exception_note,'')));
  RETURN 'RELEASED';
END; $$;
GRANT EXECUTE ON FUNCTION upwa_gate_release(UUID,UUID,TEXT,TEXT) TO authenticated;

-- Structured daily-care records remain guardian-visible only when explicitly published.
ALTER TABLE daily_care_logs ADD COLUMN IF NOT EXISTS care_type TEXT NOT NULL DEFAULT 'NOTE'
  CHECK(care_type IN ('ARRIVAL','DEPARTURE','MEAL','NAP','HYGIENE','NOTE','HEALTH_OBSERVATION'));
ALTER TABLE daily_care_logs ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS daily_care_restricted_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_log_id UUID NOT NULL UNIQUE REFERENCES daily_care_logs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES school_divisions(id),
  note TEXT NOT NULL CHECK(length(note)<=2000),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE daily_care_restricted_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY care_restricted_staff_read ON daily_care_restricted_notes FOR SELECT TO authenticated USING(upwa_has_permission('care.manage',division_id) AND upwa_can_manage_class((SELECT current_class_id FROM students WHERE id=student_id)));
GRANT SELECT,INSERT ON daily_care_restricted_notes TO authenticated;

-- Donation heritage is CMS controlled. No historical records or donor identities are seeded.
ALTER TABLE cms_entries DROP CONSTRAINT IF EXISTS cms_entries_content_type_check;
ALTER TABLE cms_entries ADD CONSTRAINT cms_entries_content_type_check CHECK(content_type IN ('PAGE','NEWS','EVENT','GALLERY','CAMPUS_TOUR','FACILITY','ACADEMIC_OFFERING','ACHIEVEMENT','LEADERSHIP_NOTE','CALENDAR','ALUMNAE','SCHOLARSHIP','DEVELOPMENT_PROJECT','DONATION_CAMPAIGN'));
CREATE TABLE IF NOT EXISTS donation_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cms_entry_id UUID UNIQUE REFERENCES cms_entries(id) ON DELETE SET NULL,
  campaign_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  purpose TEXT NOT NULL,
  target_amount NUMERIC(14,2) CHECK(target_amount IS NULL OR target_amount>0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(NOT is_active OR (is_published AND approved_by IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES donation_campaigns(id),
  amount NUMERIC(14,2) NOT NULL CHECK(amount>0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  donor_name TEXT,
  donor_email TEXT,
  donor_public_consent BOOLEAN NOT NULL DEFAULT FALSE,
  provider TEXT NOT NULL DEFAULT 'PAYSTACK' CHECK(provider IN ('PAYSTACK','BANK_TRANSFER')),
  external_reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','VERIFIED','REJECTED','REVERSED')),
  verified_at TIMESTAMPTZ,
  receipt_number TEXT UNIQUE,
  receipt_token_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS donation_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL UNIQUE REFERENCES donations(id),
  campaign_id UUID NOT NULL REFERENCES donation_campaigns(id),
  amount NUMERIC(14,2) NOT NULL CHECK(amount>0),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reverses_entry_id UUID REFERENCES donation_ledger_entries(id)
);
ALTER TABLE donation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY donation_campaigns_public_read ON donation_campaigns FOR SELECT TO anon,authenticated USING(is_published AND is_active);
CREATE POLICY donation_campaigns_admin_manage ON donation_campaigns FOR ALL TO authenticated USING(upwa_has_permission('cms.manage')) WITH CHECK(upwa_has_permission('cms.manage'));
CREATE POLICY donations_finance_read ON donations FOR SELECT TO authenticated USING(upwa_has_permission('finance.read') OR upwa_has_permission('executive.read'));
CREATE POLICY donation_ledger_exec_read ON donation_ledger_entries FOR SELECT TO authenticated USING(upwa_has_permission('finance.read') OR upwa_has_permission('executive.read'));
GRANT SELECT ON donation_campaigns TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON donation_campaigns TO authenticated;
GRANT SELECT ON donations,donation_ledger_entries TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON donations,donation_ledger_entries FROM anon,authenticated;

CREATE OR REPLACE FUNCTION upwa_record_donation_paystack_verification(p_reference TEXT,p_amount NUMERIC,p_currency TEXT,p_status TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE d donations%ROWTYPE; v_receipt TEXT;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  SELECT * INTO d FROM donations WHERE external_reference=p_reference FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No matching donation intent'; END IF;
  IF d.status='VERIFIED' THEN RETURN d.receipt_number; END IF;
  IF p_status<>'success' OR p_amount<>d.amount OR upper(p_currency)<>d.currency THEN RAISE EXCEPTION 'Donation verification mismatch'; END IF;
  v_receipt:='UPWA-D-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  UPDATE donations SET status='VERIFIED',verified_at=now(),receipt_number=v_receipt WHERE id=d.id;
  INSERT INTO donation_ledger_entries(donation_id,campaign_id,amount) VALUES(d.id,d.campaign_id,d.amount);
  RETURN v_receipt;
END; $$;
REVOKE ALL ON FUNCTION upwa_record_donation_paystack_verification(TEXT,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION upwa_record_donation_paystack_verification(TEXT,NUMERIC,TEXT,TEXT) TO service_role;

-- Prevent all direct child-release writes; the two RPCs are the only path.
REVOKE INSERT,UPDATE,DELETE ON pickup_authorisations,pickup_events FROM authenticated,anon;
REVOKE INSERT,UPDATE,DELETE ON pickup_attempts FROM authenticated,anon;

-- Lower privilege defaults for provider-specific communication credentials: keys
-- are deployment secrets, never stored in these application tables.

-- Useful management snapshot; no child names, medical data, or donor identities are returned.
CREATE OR REPLACE FUNCTION upwa_morning_brief(p_division_id UUID DEFAULT NULL,p_from DATE DEFAULT current_date-6,p_to DATE DEFAULT current_date)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_data JSONB;
BEGIN
  IF auth.role()<>'service_role' AND NOT upwa_has_permission('executive.read',p_division_id) THEN RAISE EXCEPTION 'Executive permission required'; END IF;
  SELECT jsonb_build_object(
    'period',jsonb_build_object('from',p_from,'to',p_to),
    'received',COALESCE((SELECT sum(p.amount) FROM payment_transactions p WHERE p.status='VERIFIED' AND p.verified_at::date BETWEEN p_from AND p_to AND (p_division_id IS NULL OR p.division_id=p_division_id)),0),
    'expensesApproved',COALESCE((SELECT sum(e.amount) FROM finance_expenses e WHERE e.approved_at::date BETWEEN p_from AND p_to AND e.status IN ('APPROVED','PAID') AND (p_division_id IS NULL OR p.division_id=e.division_id)),0),
    'expensesPaid',COALESCE((SELECT sum(e.amount) FROM finance_expenses e WHERE e.paid_at::date BETWEEN p_from AND p_to AND e.status='PAID' AND (p_division_id IS NULL OR p_division_id=e.division_id)),0),
    'feeCollectionByDivision',COALESCE((SELECT jsonb_agg(jsonb_build_object('division',d.name,'received',x.received) ORDER BY d.name) FROM school_divisions d LEFT JOIN LATERAL(SELECT sum(p.amount) received FROM payment_transactions p WHERE p.status='VERIFIED' AND p.verified_at::date BETWEEN p_from AND p_to AND p.division_id=d.id) x ON true WHERE p_division_id IS NULL OR d.id=p_division_id),'[]'::jsonb),
    'arrears',COALESCE((SELECT sum(GREATEST(i.total_amount-COALESCE(a.allocated,0),0)) FROM invoices i LEFT JOIN LATERAL(SELECT sum(pa.amount) allocated FROM payment_allocations pa JOIN payment_transactions p ON p.id=pa.payment_id AND p.status='VERIFIED' WHERE pa.invoice_id=i.id) a ON true WHERE i.status<>'VOID' AND (p_division_id IS NULL OR i.division_id=p_division_id)),0),
    'attendance',COALESCE((SELECT jsonb_build_object('present',count(*) FILTER(WHERE ar.status='PRESENT'),'absent',count(*) FILTER(WHERE ar.status='ABSENT'),'late',count(*) FILTER(WHERE ar.status='LATE'),'excused',count(*) FILTER(WHERE ar.status='EXCUSED'),'rate',CASE WHEN count(*) FILTER(WHERE ar.status IN ('PRESENT','ABSENT','LATE'))=0 THEN NULL ELSE round(100.0*count(*) FILTER(WHERE ar.status IN ('PRESENT','LATE'))/count(*) FILTER(WHERE ar.status IN ('PRESENT','ABSENT','LATE')),2) END) FROM attendance_records ar WHERE ar.attendance_date BETWEEN p_from AND p_to AND (p_division_id IS NULL OR ar.division_id=p_division_id)),'{}'::jsonb),
    'admissions',jsonb_build_object('received', (SELECT count(*) FROM admission_applications a WHERE a.created_at::date BETWEEN p_from AND p_to AND (p_division_id IS NULL OR a.division_id=p_division_id)), 'pending', (SELECT count(*) FROM admission_applications a WHERE a.status IN ('SUBMITTED','UNDER_REVIEW','EXAM_SCHEDULED') AND (p_division_id IS NULL OR a.division_id=p_division_id))),
    'pendingExecutiveApprovals',jsonb_build_object('resultBatches',(SELECT count(*) FROM assessment_batches b WHERE b.status IN ('SUBMITTED','REVIEWED') AND (p_division_id IS NULL OR b.division_id=p_division_id)), 'expenses',(SELECT count(*) FROM finance_expenses e WHERE e.status IN ('SUBMITTED','UNDER_REVIEW') AND (p_division_id IS NULL OR e.division_id=p_division_id)), 'feeAdjustments',(SELECT count(*) FROM fee_adjustments f WHERE f.status='PENDING' AND (p_division_id IS NULL OR f.division_id=p_division_id))),
    'operationalFlags',COALESCE((SELECT jsonb_agg(flag) FROM (SELECT 'No active approved U&C fee collection account is configured for '||d.name AS flag FROM school_divisions d WHERE (p_division_id IS NULL OR d.id=p_division_id) AND NOT EXISTS(SELECT 1 FROM cash_accounts c WHERE c.account_purpose='SCHOOL_FEES' AND c.is_active AND (c.division_id=d.id OR c.division_id IS NULL)) UNION ALL SELECT 'No current academic term is configured for '||d.name FROM school_divisions d WHERE (p_division_id IS NULL OR d.id=p_division_id) AND NOT EXISTS(SELECT 1 FROM division_academic_calendars cal WHERE cal.division_id=d.id AND cal.is_current)) flags),'[]'::jsonb),
    'upcomingMilestones',COALESCE((SELECT jsonb_agg(m ORDER BY (m->>'date')::date) FROM (SELECT jsonb_build_object('type','TERM','title',t.name||' · '||s.name,'date',s.starts_on) m FROM terms t JOIN sessions s ON s.id=t.session_id WHERE s.starts_on BETWEEN p_to AND p_to+30 AND (p_division_id IS NULL OR EXISTS(SELECT 1 FROM division_academic_calendars c WHERE c.session_id=s.id AND c.term_id=t.id AND c.division_id=p_division_id)) UNION ALL SELECT jsonb_build_object('type','ADMISSIONS','title','Admissions assessment','date',a.exam_at::date) FROM admission_applications a WHERE a.exam_at>=p_to AND a.exam_at<p_to+interval '31 days' AND a.status='EXAM_SCHEDULED' AND (p_division_id IS NULL OR a.division_id=p_division_id)) x),'[]'::jsonb)
  ) INTO v_data;
  RETURN v_data;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_morning_brief(UUID,DATE,DATE) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION upwa_claim_brief_run(p_schedule_id UUID,p_period_key TEXT,p_report JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_run UUID;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  INSERT INTO executive_brief_runs(schedule_id,period_key,status,report,attempt_count)
    VALUES(p_schedule_id,p_period_key,'PROCESSING',p_report,1)
    ON CONFLICT(schedule_id,period_key) DO UPDATE SET status='PROCESSING',report=EXCLUDED.report,attempt_count=executive_brief_runs.attempt_count+1,started_at=now(),last_error=NULL
      WHERE executive_brief_runs.status='FAILED' AND executive_brief_runs.attempt_count<4
         OR executive_brief_runs.status='PROCESSING' AND executive_brief_runs.started_at<now()-interval '15 minutes'
    RETURNING id INTO v_run;
  RETURN v_run;
END; $$;
CREATE OR REPLACE FUNCTION upwa_finish_brief_run(p_run_id UUID,p_success BOOLEAN,p_error TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  UPDATE executive_brief_runs SET status=CASE WHEN p_success THEN 'SENT' ELSE 'FAILED' END,completed_at=CASE WHEN p_success THEN now() ELSE NULL END,last_error=left(p_error,1000) WHERE id=p_run_id AND status='PROCESSING';
END; $$;
REVOKE ALL ON FUNCTION upwa_claim_brief_run(UUID,TEXT,JSONB),upwa_finish_brief_run(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION upwa_claim_brief_run(UUID,TEXT,JSONB),upwa_finish_brief_run(UUID,BOOLEAN,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION upwa_notification_attempt(p_notification_id UUID,p_provider TEXT,p_success BOOLEAN,p_message_id TEXT DEFAULT NULL,p_error_code TEXT DEFAULT NULL,p_error_message TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE n notification_outbox%ROWTYPE; v_attempt INTEGER;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  SELECT * INTO n FROM notification_outbox WHERE id=p_notification_id FOR UPDATE;
  IF NOT FOUND OR n.status IN ('SENT','CANCELLED') THEN RETURN; END IF;
  v_attempt:=n.attempt_count+1;
  INSERT INTO notification_attempts(notification_id,attempt_number,provider,success,provider_message_id,error_code,error_message)
    VALUES(n.id,v_attempt,p_provider,p_success,p_message_id,left(p_error_code,100),left(p_error_message,1000));
  UPDATE notification_outbox SET attempt_count=v_attempt,status=CASE WHEN p_success THEN 'SENT' WHEN v_attempt>=5 THEN 'FAILED' ELSE 'PENDING' END,
    sent_at=CASE WHEN p_success THEN now() ELSE NULL END,provider_message_id=p_message_id,last_error=left(p_error_message,1000),
    next_attempt_at=now()+make_interval(mins=>LEAST(60,5*(2^LEAST(v_attempt,4)))) WHERE id=n.id;
END; $$;
REVOKE ALL ON FUNCTION upwa_notification_attempt(UUID,TEXT,BOOLEAN,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION upwa_notification_attempt(UUID,TEXT,BOOLEAN,TEXT,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION upwa_enqueue_event_triggers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE s RECORD;
BEGIN
  IF TG_TABLE_NAME='payment_transactions' AND NEW.status='VERIFIED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM upwa_enqueue_parent_notice(NEW.student_id,'PAYMENT_CONFIRMED',NEW.id::text);
  ELSIF TG_TABLE_NAME='assessment_batches' AND NEW.status='PUBLISHED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR s IN SELECT DISTINCT student_id FROM assessment_scores WHERE class_id=NEW.class_id AND subject_id=NEW.subject_id AND session_id=NEW.session_id AND term_id=NEW.term_id AND status='PUBLISHED' LOOP
      PERFORM upwa_enqueue_parent_notice(s.student_id,'RESULT_PUBLISHED',NEW.id::text||':'||NEW.version::text);
    END LOOP;
  ELSIF TG_TABLE_NAME='attendance_records' AND NEW.status='ABSENT' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM upwa_enqueue_parent_notice(NEW.student_id,'ABSENCE',NEW.id::text);
  ELSIF TG_TABLE_NAME='daily_care_logs' AND NEW.guardian_visible AND (TG_OP='INSERT' OR OLD.guardian_visible IS DISTINCT FROM NEW.guardian_visible) THEN
    PERFORM upwa_enqueue_parent_notice(NEW.student_id,'CARE_UPDATE',NEW.id::text);
  ELSIF TG_TABLE_NAME='admission_applications' AND NEW.enrolled_student_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM upwa_enqueue_parent_notice(NEW.enrolled_student_id,'ADMISSION_UPDATE',NEW.id::text||':'||NEW.status);
  ELSIF TG_TABLE_NAME='cms_entries' AND NEW.status='PUBLISHED' AND NEW.content_type='NEWS' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    FOR s IN SELECT id FROM students WHERE status='ACTIVE' AND (NEW.division_id IS NULL OR current_division_id=NEW.division_id) LOOP
      PERFORM upwa_enqueue_parent_notice(s.id,'URGENT_NOTICE',NEW.id::text||':'||NEW.updated_at::text);
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_payment_notify ON payment_transactions;
CREATE TRIGGER trg_payment_notify AFTER UPDATE OF status ON payment_transactions FOR EACH ROW EXECUTE FUNCTION upwa_enqueue_event_triggers();
DROP TRIGGER IF EXISTS trg_result_notify ON assessment_batches;
CREATE TRIGGER trg_result_notify AFTER UPDATE OF status ON assessment_batches FOR EACH ROW EXECUTE FUNCTION upwa_enqueue_event_triggers();
DROP TRIGGER IF EXISTS trg_absence_notify ON attendance_records;
CREATE TRIGGER trg_absence_notify AFTER INSERT OR UPDATE OF status ON attendance_records FOR EACH ROW EXECUTE FUNCTION upwa_enqueue_event_triggers();
DROP TRIGGER IF EXISTS trg_care_notify ON daily_care_logs;
CREATE TRIGGER trg_care_notify AFTER INSERT OR UPDATE OF guardian_visible ON daily_care_logs FOR EACH ROW EXECUTE FUNCTION upwa_enqueue_event_triggers();
DROP TRIGGER IF EXISTS trg_admission_notify ON admission_applications;
CREATE TRIGGER trg_admission_notify AFTER UPDATE OF status ON admission_applications FOR EACH ROW EXECUTE FUNCTION upwa_enqueue_event_triggers();
DROP TRIGGER IF EXISTS trg_urgent_notice_notify ON cms_entries;
CREATE TRIGGER trg_urgent_notice_notify AFTER INSERT OR UPDATE OF status ON cms_entries FOR EACH ROW EXECUTE FUNCTION upwa_enqueue_event_triggers();

ALTER TABLE executive_brief_schedules DROP CONSTRAINT IF EXISTS executive_brief_schedules_owner_id_recipient_user_id_division_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS executive_brief_schedule_unique_idx ON executive_brief_schedules(owner_id,recipient_user_id,division_id) NULLS NOT DISTINCT;
GRANT SELECT,INSERT,UPDATE ON executive_brief_schedules,executive_brief_runs TO service_role;
GRANT SELECT,INSERT,UPDATE ON notification_outbox,notification_attempts,notification_templates TO service_role;
GRANT SELECT,INSERT,UPDATE ON donations,donation_ledger_entries TO service_role;

ALTER TABLE cash_accounts ADD CONSTRAINT cash_accounts_independent_approval_check CHECK(approved_by IS NULL OR approved_by<>created_by);
DROP POLICY IF EXISTS cash_accounts_manage ON cash_accounts;
REVOKE INSERT,UPDATE,DELETE ON cash_accounts FROM anon,authenticated;
GRANT SELECT ON cash_accounts TO authenticated;
CREATE OR REPLACE FUNCTION upwa_approve_cash_account(p_account_id UUID,p_active BOOLEAN)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE a cash_accounts%ROWTYPE;
BEGIN
  SELECT * INTO a FROM cash_accounts WHERE id=p_account_id FOR UPDATE;
  IF NOT FOUND OR NOT upwa_has_permission('finance.manage',a.division_id) OR a.created_by=auth.uid() THEN RAISE EXCEPTION 'A different authorised finance user must approve bank instructions'; END IF;
  IF p_active THEN
    UPDATE cash_accounts SET is_active=false WHERE account_purpose=a.account_purpose AND division_id IS NOT DISTINCT FROM a.division_id AND id<>a.id;
    UPDATE cash_accounts SET is_active=true,approved_by=auth.uid(),approved_at=now() WHERE id=a.id;
    RETURN 'ACTIVE';
  END IF;
  UPDATE cash_accounts SET is_active=false WHERE id=a.id;
  RETURN 'INACTIVE';
END; $$;
GRANT EXECUTE ON FUNCTION upwa_approve_cash_account(UUID,BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_get_guardian_bank_instructions(p_invoice_id UUID,p_amount NUMERIC DEFAULT NULL)
RETURNS TABLE(payment_id UUID,amount NUMERIC,account_name TEXT,account_number TEXT,bank_name TEXT,bank_branch TEXT,reference TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE i invoices%ROWTYPE; v_due NUMERIC; v_amount NUMERIC; v_payment UUID; v_reference TEXT; a RECORD;
BEGIN
  SELECT * INTO i FROM invoices WHERE id=p_invoice_id;
  IF NOT FOUND OR NOT upwa_is_guardian_of(i.student_id) THEN RAISE EXCEPTION 'This invoice is not linked to your family account'; END IF;
  SELECT GREATEST(i.total_amount-COALESCE(sum(pa.amount),0),0) INTO v_due FROM payment_allocations pa JOIN payment_transactions p ON p.id=pa.payment_id AND p.status='VERIFIED' WHERE pa.invoice_id=i.id;
  v_due:=COALESCE(v_due,i.total_amount);
  v_amount:=COALESCE(p_amount,v_due);
  IF v_amount<=0 OR v_amount>v_due OR v_amount>100000000 THEN RAISE EXCEPTION 'Enter an installment up to the verified remaining balance'; END IF;
  SELECT * INTO a FROM cash_accounts WHERE account_purpose='SCHOOL_FEES' AND is_active AND (division_id=i.division_id OR division_id IS NULL) ORDER BY (division_id IS NULL),created_at DESC LIMIT 1;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Approved school bank instructions are not yet configured'; END IF;
  v_reference:='UPWA-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  INSERT INTO payment_transactions(division_id,student_id,provider,external_reference,amount,currency,status,metadata,created_by)
    VALUES(i.division_id,i.student_id,'BANK_TRANSFER',v_reference,v_amount,'NGN','PENDING',jsonb_build_object('invoice_id',i.id,'account_id',a.id,'channel','BANK_TRANSFER'),auth.uid()) RETURNING id INTO v_payment;
  RETURN QUERY SELECT v_payment,v_amount,a.account_name,a.account_number,a.institution_name,a.bank_branch,v_reference;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_get_guardian_bank_instructions(UUID,NUMERIC) TO authenticated;

-- Private evidence and pickup photos are never made public; browser uploads are scoped by database records.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
  ('upwa-payment-evidence','upwa-payment-evidence',false,5242880,ARRAY['application/pdf','image/jpeg','image/png']),
  ('upwa-pickup-photos','upwa-pickup-photos',false,5242880,ARRAY['image/jpeg','image/png'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS payment_evidence_object_parent_read ON storage.objects;
CREATE POLICY payment_evidence_object_parent_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='upwa-payment-evidence' AND EXISTS(
  SELECT 1 FROM payment_transactions p WHERE p.id=NULLIF(split_part(name,'/',1),'')::uuid AND (upwa_is_guardian_of(p.student_id) OR upwa_has_permission('finance.read',p.division_id))));
DROP POLICY IF EXISTS payment_evidence_object_parent_insert ON storage.objects;
CREATE POLICY payment_evidence_object_parent_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='upwa-payment-evidence' AND EXISTS(
  SELECT 1 FROM payment_transactions p WHERE p.id=NULLIF(split_part(name,'/',1),'')::uuid AND p.status IN ('PENDING','EVIDENCE_SUBMITTED') AND p.provider='BANK_TRANSFER' AND upwa_is_guardian_of(p.student_id)));
DROP POLICY IF EXISTS pickup_photo_gate_read ON storage.objects;
CREATE POLICY pickup_photo_gate_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='upwa-pickup-photos' AND EXISTS(
  SELECT 1 FROM students s WHERE s.id=NULLIF(split_part(name,'/',1),'')::uuid AND upwa_has_permission('pickup.manage',s.current_division_id)));
DROP POLICY IF EXISTS pickup_photo_guardian_read ON storage.objects;
CREATE POLICY pickup_photo_guardian_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='upwa-pickup-photos' AND EXISTS(
  SELECT 1 FROM student_guardians sg JOIN guardians g ON g.id=sg.guardian_id
  WHERE sg.student_id=NULLIF(split_part(name,'/',1),'')::uuid AND g.user_id=auth.uid() AND sg.can_authorize_pickup));
DROP POLICY IF EXISTS pickup_photo_guardian_insert ON storage.objects;
CREATE POLICY pickup_photo_guardian_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='upwa-pickup-photos' AND EXISTS(
  SELECT 1 FROM student_guardians sg JOIN guardians g ON g.id=sg.guardian_id JOIN students s ON s.id=sg.student_id JOIN school_divisions d ON d.id=s.current_division_id
  WHERE sg.student_id=NULLIF(split_part(name,'/',1),'')::uuid AND g.user_id=auth.uid() AND sg.can_authorize_pickup AND d.code='PRIMARY_EARLY_YEARS'));

-- Update existing lookups to return a private signed URL only after scoped authorization.
GRANT SELECT ON student_medical_alerts TO authenticated;

CREATE OR REPLACE FUNCTION upwa_enqueue_parent_notice(p_student_id UUID,p_event_type TEXT,p_event_key TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE g RECORD; t RECORD; v_added INTEGER:=0; v_recipient TEXT;
BEGIN
  IF p_event_type NOT IN ('RESULT_PUBLISHED','PAYMENT_CONFIRMED','ABSENCE','ADMISSION_UPDATE','URGENT_NOTICE','CARE_UPDATE') THEN RAISE EXCEPTION 'Unsupported notification type'; END IF;
  FOR g IN SELECT sg.guardian_id,gu.email,gu.phone,gu.email_verified_at,gu.phone_verified_at,
      COALESCE(cp.email_enabled,false) email_enabled,COALESCE(cp.sms_enabled,false) sms_enabled,COALESCE(cp.whatsapp_enabled,false) whatsapp_enabled
    FROM student_guardians sg JOIN guardians gu ON gu.id=sg.guardian_id
    LEFT JOIN communication_preferences cp ON cp.guardian_id=sg.guardian_id AND cp.student_id=sg.student_id AND cp.event_type=p_event_type
    WHERE sg.student_id=p_student_id LOOP
    FOR t IN SELECT nt.channel,nt.subject,nt.body FROM notification_templates nt WHERE nt.event_type=p_event_type AND nt.is_active LOOP
      v_recipient:=NULL;
      IF t.channel='EMAIL' AND g.email_enabled AND g.email_verified_at IS NOT NULL THEN v_recipient:=g.email;
      ELSIF t.channel='SMS' AND g.sms_enabled AND g.phone_verified_at IS NOT NULL THEN v_recipient:=g.phone;
      ELSIF t.channel='WHATSAPP' AND g.whatsapp_enabled AND g.phone_verified_at IS NOT NULL THEN v_recipient:=g.phone; END IF;
      IF v_recipient IS NOT NULL AND length(v_recipient)>3 THEN
        INSERT INTO notification_outbox(guardian_id,student_id,event_type,event_key,channel,recipient,subject,body,next_attempt_at)
          VALUES(g.guardian_id,p_student_id,p_event_type,p_event_key,t.channel,v_recipient,t.subject,t.body,
            CASE WHEN p_event_type='ABSENCE' THEN now()+make_interval(mins=>COALESCE((SELECT ads.absence_notification_delay_minutes FROM academic_division_settings ads JOIN students st ON st.current_division_id=ads.division_id WHERE st.id=p_student_id),30)) ELSE now() END)
          ON CONFLICT(event_key,guardian_id,channel) DO NOTHING;
        IF FOUND THEN v_added:=v_added+1; END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_added;
END; $$;
REVOKE ALL ON FUNCTION upwa_enqueue_parent_notice(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION upwa_enqueue_parent_notice(UUID,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION upwa_consume_rate_limit(p_key TEXT,p_limit INTEGER,p_window_seconds INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_count INTEGER; v_start TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authenticated user required'; END IF;
  IF p_limit<1 OR p_window_seconds<1 OR length(p_key)>80 THEN RAISE EXCEPTION 'Invalid rate limit'; END IF;
  INSERT INTO api_rate_limits(user_id,action_key,window_started_at,request_count) VALUES(auth.uid(),p_key,now(),1)
    ON CONFLICT(user_id,action_key) DO UPDATE SET window_started_at=CASE WHEN api_rate_limits.window_started_at+make_interval(secs=>p_window_seconds)<=now() THEN now() ELSE api_rate_limits.window_started_at END,
      request_count=CASE WHEN api_rate_limits.window_started_at+make_interval(secs=>p_window_seconds)<=now() THEN 1 ELSE api_rate_limits.request_count+1 END
    RETURNING request_count,window_started_at INTO v_count,v_start;
  RETURN v_count<=p_limit;
END; $$;
CREATE TABLE IF NOT EXISTS api_rate_limits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK(request_count>=0),
  PRIMARY KEY(user_id,action_key)
);
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON api_rate_limits FROM anon,authenticated;
REVOKE ALL ON FUNCTION upwa_consume_rate_limit(TEXT,INTEGER,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION upwa_consume_rate_limit(TEXT,INTEGER,INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_create_donation_intent(p_campaign_id UUID,p_reference TEXT,p_amount NUMERIC,p_donor_name TEXT,p_donor_email TEXT,p_receipt_token_hash TEXT,p_public_consent BOOLEAN)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE c donation_campaigns%ROWTYPE; v_id UUID;
BEGIN
  IF auth.role() NOT IN ('anon','authenticated') THEN RAISE EXCEPTION 'Public donation intent only'; END IF;
  SELECT * INTO c FROM donation_campaigns WHERE id=p_campaign_id AND is_published AND is_active;
  IF NOT FOUND OR p_amount<100 OR p_amount>100000000 OR p_reference !~ '^UPWA-DON-[A-F0-9]{24}$' THEN RAISE EXCEPTION 'Campaign or donation amount is invalid'; END IF;
  IF p_donor_email IS NOT NULL AND p_donor_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN RAISE EXCEPTION 'Email address is invalid'; END IF;
  INSERT INTO donations(campaign_id,amount,currency,donor_name,donor_email,donor_public_consent,external_reference,receipt_token_hash)
    VALUES(c.id,p_amount,c.currency,left(NULLIF(trim(p_donor_name),''),160),lower(NULLIF(trim(p_donor_email),'')),COALESCE(p_public_consent,false),p_reference,p_receipt_token_hash) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION upwa_create_donation_intent(UUID,TEXT,NUMERIC,TEXT,TEXT,TEXT,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upwa_create_donation_intent(UUID,TEXT,NUMERIC,TEXT,TEXT,TEXT,BOOLEAN) TO anon,authenticated;

CREATE OR REPLACE FUNCTION upwa_get_donation_receipt(p_token_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_build_object('receiptNumber',d.receipt_number,'amount',d.amount,'currency',d.currency,'campaign',c.title,'issuedAt',d.verified_at)
    INTO v_result FROM donations d JOIN donation_campaigns c ON c.id=d.campaign_id
    WHERE d.receipt_token_hash=p_token_hash AND d.status='VERIFIED';
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION upwa_get_donation_receipt(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upwa_get_donation_receipt(TEXT) TO service_role;

-- Keep report recipients and sensitive account/provider values away from broad reads.
CREATE POLICY notification_templates_staff_manage ON notification_templates FOR ALL TO authenticated USING(upwa_has_permission('communications.manage')) WITH CHECK(upwa_has_permission('communications.manage'));
GRANT INSERT,UPDATE,DELETE ON notification_templates TO authenticated;
CREATE POLICY care_restricted_caregiver_insert ON daily_care_restricted_notes FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND upwa_has_permission('care.manage',division_id) AND EXISTS(SELECT 1 FROM students s WHERE s.id=student_id AND s.current_division_id=division_id AND upwa_can_manage_class(s.current_class_id)));

-- Make the approved bank account an independent two-person setup and approval workflow.
CREATE OR REPLACE FUNCTION upwa_create_cash_account(p_division_id UUID,p_account_name TEXT,p_account_number TEXT,p_branch TEXT,p_purpose TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT upwa_has_permission('finance.manage',p_division_id) OR p_purpose NOT IN ('SCHOOL_FEES','DONATIONS','OPERATIONS') OR length(trim(p_account_name))<3 OR p_account_number !~ '^[0-9]{8,20}$' THEN RAISE EXCEPTION 'Valid finance account details and division permission are required'; END IF;
  INSERT INTO cash_accounts(division_id,institution_name,account_name,account_number,bank_branch,account_purpose,is_active,created_by)
    VALUES(p_division_id,'U&C Microfinance Bank',trim(p_account_name),p_account_number,trim(p_branch),p_purpose,false,auth.uid()) RETURNING id INTO v_id;
  INSERT INTO finance_activity(division_id,actor_id,action,entity_type,entity_id,metadata) VALUES(p_division_id,auth.uid(),'BANK_ACCOUNT_SUBMITTED','cash_account',v_id,jsonb_build_object('purpose',p_purpose,'bank','U&C Microfinance Bank'));
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_create_cash_account(UUID,TEXT,TEXT,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_approve_cash_account(p_account_id UUID,p_active BOOLEAN)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE a cash_accounts%ROWTYPE;
BEGIN
  SELECT * INTO a FROM cash_accounts WHERE id=p_account_id FOR UPDATE;
  IF NOT FOUND OR NOT upwa_has_permission('finance.manage',a.division_id) OR a.created_by=auth.uid() THEN RAISE EXCEPTION 'A different authorised finance user must approve bank instructions'; END IF;
  IF p_active THEN
    UPDATE cash_accounts SET is_active=false WHERE account_purpose=a.account_purpose AND division_id IS NOT DISTINCT FROM a.division_id AND id<>a.id;
    UPDATE cash_accounts SET is_active=true,approved_by=auth.uid(),approved_at=now() WHERE id=a.id;
    RETURN 'ACTIVE';
  END IF;
  UPDATE cash_accounts SET is_active=false WHERE id=a.id;
  RETURN 'INACTIVE';
END; $$;
GRANT EXECUTE ON FUNCTION upwa_approve_cash_account(UUID,BOOLEAN) TO authenticated;

ALTER TABLE executive_brief_runs ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE OR REPLACE FUNCTION upwa_claim_brief_run(p_schedule_id UUID,p_period_key TEXT,p_report JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_run UUID;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  INSERT INTO executive_brief_runs(schedule_id,period_key,status,report,attempt_count,next_attempt_at)
    VALUES(p_schedule_id,p_period_key,'PROCESSING',p_report,1,now())
    ON CONFLICT(schedule_id,period_key) DO UPDATE SET status='PROCESSING',report=EXCLUDED.report,attempt_count=executive_brief_runs.attempt_count+1,started_at=now(),last_error=NULL
      WHERE (executive_brief_runs.status='FAILED' AND executive_brief_runs.attempt_count<4 AND executive_brief_runs.next_attempt_at<=now())
         OR (executive_brief_runs.status='PROCESSING' AND executive_brief_runs.started_at<now()-interval '15 minutes')
    RETURNING id INTO v_run;
  RETURN v_run;
END; $$;
CREATE OR REPLACE FUNCTION upwa_finish_brief_run(p_run_id UUID,p_success BOOLEAN,p_error TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_schedule UUID;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  UPDATE executive_brief_runs SET status=CASE WHEN p_success THEN 'SENT' ELSE 'FAILED' END,completed_at=CASE WHEN p_success THEN now() ELSE NULL END,
    last_error=left(p_error,1000),next_attempt_at=now()+CASE WHEN p_success THEN interval '100 years' ELSE make_interval(mins=>LEAST(240,5*(2^LEAST(attempt_count,5)))) END
    WHERE id=p_run_id AND status='PROCESSING' RETURNING schedule_id INTO v_schedule;
  IF p_success AND v_schedule IS NOT NULL THEN
    UPDATE executive_brief_schedules SET next_run_at=CASE frequency WHEN 'DAILY' THEN now()+interval '1 day' WHEN 'WEEKLY' THEN now()+interval '7 days' ELSE date_trunc('month',now())+interval '1 month' END,
      last_period_key=(SELECT period_key FROM executive_brief_runs WHERE id=p_run_id),updated_at=now() WHERE id=v_schedule;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION upwa_claim_brief_run(UUID,TEXT,JSONB),upwa_finish_brief_run(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION upwa_claim_brief_run(UUID,TEXT,JSONB),upwa_finish_brief_run(UUID,BOOLEAN,TEXT) TO service_role;

CREATE TABLE IF NOT EXISTS public_rate_limits (
  key_hash TEXT PRIMARY KEY CHECK(length(key_hash)=64),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK(request_count>=0)
);
ALTER TABLE public_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public_rate_limits FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION upwa_consume_public_rate_limit(p_key_hash TEXT,p_limit INTEGER,p_window_seconds INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_count INTEGER;
BEGIN
  IF auth.role()<>'service_role' OR p_key_hash !~ '^[a-f0-9]{64}$' OR p_limit<1 OR p_window_seconds<1 THEN RAISE EXCEPTION 'Invalid service rate-limit request'; END IF;
  INSERT INTO public_rate_limits(key_hash,window_started_at,request_count) VALUES(p_key_hash,now(),1)
    ON CONFLICT(key_hash) DO UPDATE SET window_started_at=CASE WHEN public_rate_limits.window_started_at+make_interval(secs=>p_window_seconds)<=now() THEN now() ELSE public_rate_limits.window_started_at END,
      request_count=CASE WHEN public_rate_limits.window_started_at+make_interval(secs=>p_window_seconds)<=now() THEN 1 ELSE public_rate_limits.request_count+1 END
    RETURNING request_count INTO v_count;
  RETURN v_count<=p_limit;
END; $$;
REVOKE ALL ON FUNCTION upwa_consume_public_rate_limit(TEXT,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION upwa_consume_public_rate_limit(TEXT,INTEGER,INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION upwa_create_donation_intent(p_campaign_id UUID,p_reference TEXT,p_amount NUMERIC,p_donor_name TEXT,p_donor_email TEXT,p_receipt_token_hash TEXT,p_public_consent BOOLEAN)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE c donation_campaigns%ROWTYPE; v_id UUID;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  SELECT * INTO c FROM donation_campaigns WHERE id=p_campaign_id AND is_published AND is_active;
  IF NOT FOUND OR p_amount<100 OR p_amount>100000000 OR p_reference !~ '^UPWA-DON-[A-F0-9]{24}$' THEN RAISE EXCEPTION 'Campaign or donation amount is invalid'; END IF;
  IF p_donor_email IS NOT NULL AND p_donor_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN RAISE EXCEPTION 'Email address is invalid'; END IF;
  INSERT INTO donations(campaign_id,amount,currency,donor_name,donor_email,donor_public_consent,external_reference,receipt_token_hash)
    VALUES(c.id,p_amount,c.currency,left(NULLIF(trim(p_donor_name),''),160),lower(NULLIF(trim(p_donor_email),'')),COALESCE(p_public_consent,false),p_reference,p_receipt_token_hash) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION upwa_create_donation_intent(UUID,TEXT,NUMERIC,TEXT,TEXT,TEXT,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION upwa_create_donation_intent(UUID,TEXT,NUMERIC,TEXT,TEXT,TEXT,BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION upwa_revoke_pickup_authorisation(p_authorisation_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE a pickup_authorisations%ROWTYPE;
BEGIN
  SELECT * INTO a FROM pickup_authorisations WHERE id=p_authorisation_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM student_guardians sg JOIN guardians g ON g.id=sg.guardian_id WHERE sg.student_id=a.student_id AND g.user_id=auth.uid() AND sg.can_authorize_pickup) THEN RAISE EXCEPTION 'Only an authorised linked guardian can revoke this pickup person'; END IF;
  UPDATE pickup_authorisations SET is_active=false WHERE id=a.id;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_revoke_pickup_authorisation(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION upwa_record_care_event(p_student_id UUID,p_care_type TEXT,p_log_date DATE,p_summary TEXT,p_details JSONB,p_guardian_visible BOOLEAN,p_restricted_note TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE s students%ROWTYPE; v_log UUID; v_division_code TEXT;
BEGIN
  SELECT * INTO s FROM students WHERE id=p_student_id;
  SELECT code INTO v_division_code FROM school_divisions WHERE id=s.current_division_id;
  IF s.id IS NULL OR v_division_code<>'PRIMARY_EARLY_YEARS' OR NOT upwa_has_permission('care.manage',s.current_division_id) OR NOT upwa_can_manage_class(s.current_class_id) THEN RAISE EXCEPTION 'An assigned early-years caregiver is required'; END IF;
  IF p_care_type NOT IN ('ARRIVAL','DEPARTURE','MEAL','NAP','HYGIENE','NOTE','HEALTH_OBSERVATION') OR length(trim(p_summary))<1 OR length(p_summary)>2000 OR (p_details IS NOT NULL AND octet_length(p_details::text)>8000) THEN RAISE EXCEPTION 'Invalid care event'; END IF;
  IF p_guardian_visible AND p_care_type='HEALTH_OBSERVATION' THEN RAISE EXCEPTION 'Health observations cannot be published to guardians'; END IF;
  INSERT INTO daily_care_logs(student_id,division_id,class_id,log_date,log_type,care_type,summary,details,guardian_visible,created_by)
    VALUES(s.id,s.current_division_id,s.current_class_id,COALESCE(p_log_date,current_date),'DAILY_CARE',p_care_type,
      CASE WHEN p_care_type='HEALTH_OBSERVATION' THEN 'Restricted observation recorded' ELSE trim(p_summary) END,
      COALESCE(p_details,'{}'::jsonb),p_guardian_visible,auth.uid()) RETURNING id INTO v_log;
  IF NULLIF(trim(COALESCE(p_restricted_note,'')),'') IS NOT NULL THEN
    INSERT INTO daily_care_restricted_notes(care_log_id,student_id,division_id,note,created_by) VALUES(v_log,s.id,s.current_division_id,left(trim(p_restricted_note),2000),auth.uid());
  END IF;
  RETURN v_log;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_record_care_event(UUID,TEXT,DATE,TEXT,JSONB,BOOLEAN,TEXT) TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON daily_care_logs FROM anon,authenticated;

CREATE OR REPLACE FUNCTION upwa_claim_notification(p_notification_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE n notification_outbox%ROWTYPE;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  UPDATE notification_outbox SET status='SENDING' WHERE id=p_notification_id AND status IN ('PENDING','FAILED') AND next_attempt_at<=now() AND attempt_count<5 RETURNING * INTO n;
  IF n.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',n.id,'channel',n.channel,'recipient',n.recipient,'subject',n.subject,'body',n.body,'attempt',n.attempt_count+1);
END; $$;
REVOKE ALL ON FUNCTION upwa_claim_notification(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION upwa_claim_notification(UUID) TO service_role;

REVOKE INSERT,UPDATE,DELETE ON donation_campaigns FROM authenticated;
GRANT SELECT ON donation_campaigns TO authenticated;
CREATE OR REPLACE FUNCTION upwa_create_donation_campaign(p_cms_entry_id UUID,p_campaign_code TEXT,purpose TEXT,p_target NUMERIC DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE e cms_entries%ROWTYPE; v_id UUID;
BEGIN
  IF NOT upwa_has_permission('cms.manage') THEN RAISE EXCEPTION 'CMS permission required'; END IF;
  SELECT * INTO e FROM cms_entries WHERE id=p_cms_entry_id AND content_type='DONATION_CAMPAIGN';
  IF NOT FOUND OR p_campaign_code !~ '^[a-z0-9-]{3,60}$' OR length(trim(purpose))<5 OR (p_target IS NOT NULL AND p_target<=0) THEN RAISE EXCEPTION 'Approved campaign content and a valid purpose are required'; END IF;
  INSERT INTO donation_campaigns(cms_entry_id,campaign_code,title,purpose,target_amount,currency,is_published,is_active,created_by)
    VALUES(e.id,p_campaign_code,e.title,trim(purpose),p_target,'NGN',false,false,auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
CREATE OR REPLACE FUNCTION upwa_approve_donation_campaign(p_campaign_id UUID,p_approve BOOLEAN)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE c donation_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO c FROM donation_campaigns WHERE id=p_campaign_id FOR UPDATE;
  IF NOT FOUND OR NOT upwa_has_permission('communications.manage') OR c.created_by=auth.uid() THEN RAISE EXCEPTION 'Independent communications approver required'; END IF;
  IF p_approve AND NOT EXISTS(SELECT 1 FROM cms_entries e WHERE e.id=c.cms_entry_id AND e.status='PUBLISHED' AND e.content_type='DONATION_CAMPAIGN') THEN RAISE EXCEPTION 'The associated campaign content must be published first'; END IF;
  UPDATE donation_campaigns SET is_published=p_approve,is_active=p_approve,approved_by=CASE WHEN p_approve THEN auth.uid() ELSE NULL END WHERE id=c.id;
  RETURN CASE WHEN p_approve THEN 'ACTIVE' ELSE 'INACTIVE' END;
END; $$;
GRANT EXECUTE ON FUNCTION upwa_create_donation_campaign(UUID,TEXT,TEXT,NUMERIC),upwa_approve_donation_campaign(UUID,BOOLEAN) TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS cash_accounts_one_active_idx ON cash_accounts((COALESCE(division_id,'00000000-0000-0000-0000-000000000000'::uuid)),account_purpose) WHERE is_active;

CREATE UNIQUE INDEX IF NOT EXISTS bank_settlement_reference_unique_idx ON payment_transactions(settlement_reference) WHERE provider='BANK_TRANSFER' AND settlement_reference IS NOT NULL;
