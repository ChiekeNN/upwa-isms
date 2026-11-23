-- Migration applied after an end-to-end privilege check found a later table-level
-- grant superseded the intended column-level boundary in migration 00003.
REVOKE SELECT, INSERT, UPDATE ON TABLE public.students FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, admission_number, first_name, last_name, middle_name, date_of_birth, gender,
  current_division_id, current_class_id, status, photo_storage_path, created_at)
ON TABLE public.students TO authenticated;
