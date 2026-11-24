-- Authorised academic setup: sessions, terms, school levels, classes, arms and subjects.
-- This migration intentionally adds access controls before exposing CRUD to the app.

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sessions_authorised_read ON sessions;
CREATE POLICY sessions_authorised_read ON sessions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  WHERE ur.user_id = auth.uid() AND rp.permission_code IN ('academics.read', 'registry.manage')
));
DROP POLICY IF EXISTS sessions_registry_manage ON sessions;
CREATE POLICY sessions_registry_manage ON sessions FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  WHERE ur.user_id = auth.uid() AND rp.permission_code = 'registry.manage'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  WHERE ur.user_id = auth.uid() AND rp.permission_code = 'registry.manage'
));

DROP POLICY IF EXISTS terms_authorised_read ON terms;
CREATE POLICY terms_authorised_read ON terms FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  WHERE ur.user_id = auth.uid() AND rp.permission_code IN ('academics.read', 'registry.manage')
));
DROP POLICY IF EXISTS terms_registry_manage ON terms;
CREATE POLICY terms_registry_manage ON terms FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  WHERE ur.user_id = auth.uid() AND rp.permission_code = 'registry.manage'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  WHERE ur.user_id = auth.uid() AND rp.permission_code = 'registry.manage'
));

-- School sections represent education levels and are scoped to the administrator's division.
DROP POLICY IF EXISTS school_sections_signed_in_read ON school_sections;
DROP POLICY IF EXISTS school_sections_authorised_read ON school_sections;
CREATE POLICY school_sections_authorised_read ON school_sections FOR SELECT TO authenticated
USING (upwa_has_permission('academics.read', division_id) OR upwa_has_permission('registry.manage', division_id));
DROP POLICY IF EXISTS school_sections_registry_manage ON school_sections;
CREATE POLICY school_sections_registry_manage ON school_sections FOR ALL TO authenticated
USING (upwa_has_permission('registry.manage', division_id))
WITH CHECK (upwa_has_permission('registry.manage', division_id));

-- Class arms have no division column; authority is derived from their parent class.
DROP POLICY IF EXISTS class_arms_registry_manage ON class_arms;
CREATE POLICY class_arms_registry_manage ON class_arms FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND upwa_has_permission('registry.manage', c.division_id)))
WITH CHECK (EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND upwa_has_permission('registry.manage', c.division_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON sessions, terms, school_sections, class_arms TO authenticated;

-- Set the current session and optional term atomically; never leave multiple current periods.
CREATE OR REPLACE FUNCTION upwa_set_current_academic_period(p_session_id UUID, p_term_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    WHERE ur.user_id = auth.uid() AND rp.permission_code = 'registry.manage'
  ) THEN
    RAISE EXCEPTION 'Registry management permission is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_session_id) THEN
    RAISE EXCEPTION 'The selected session does not exist';
  END IF;
  IF p_term_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM terms WHERE id = p_term_id AND session_id = p_session_id
  ) THEN
    RAISE EXCEPTION 'The selected term does not belong to the selected session';
  END IF;
  UPDATE sessions SET is_current = (id = p_session_id);
  UPDATE terms SET is_current = (session_id = p_session_id AND id = p_term_id);
END;
$$;
REVOKE ALL ON FUNCTION upwa_set_current_academic_period(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upwa_set_current_academic_period(UUID, UUID) TO authenticated;
