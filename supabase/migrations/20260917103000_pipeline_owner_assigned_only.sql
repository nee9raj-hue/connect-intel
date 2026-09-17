-- Lead owner is assignee only. Importer / saved-by must not become owner_id.

CREATE OR REPLACE FUNCTION public.pipeline_leads_sync_scope_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_team_id TEXT;
  v_department_id TEXT;
  v_collaborators text[] := '{}';
  v_task jsonb;
  v_meeting jsonb;
  v_id text;
BEGIN
  NEW.owner_id := NULLIF(btrim(NEW.entry->>'assignedToUserId'), '');
  NEW.lead_status := COALESCE(NULLIF(btrim(NEW.entry->'crm'->>'status'), ''), 'new');

  IF jsonb_typeof(NEW.entry->'collaboratorUserIds') = 'array' THEN
    SELECT COALESCE(array_agg(btrim(value::text)), '{}')
    INTO v_collaborators
    FROM jsonb_array_elements_text(NEW.entry->'collaboratorUserIds') AS value
    WHERE btrim(value::text) <> '';
  END IF;

  FOR v_task IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.entry->'crm'->'tasks', '[]'::jsonb))
  LOOP
    v_id := NULLIF(btrim(v_task->>'assignedToUserId'), '');
    IF v_id IS NOT NULL THEN v_collaborators := array_append(v_collaborators, v_id); END IF;
    IF jsonb_typeof(v_task->'participantUserIds') = 'array' THEN
      SELECT v_collaborators || COALESCE(array_agg(btrim(value::text)), '{}')
      INTO v_collaborators
      FROM jsonb_array_elements_text(v_task->'participantUserIds') AS value
      WHERE btrim(value::text) <> '';
    END IF;
  END LOOP;

  FOR v_meeting IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.entry->'crm'->'meetings', '[]'::jsonb))
  LOOP
    v_id := NULLIF(btrim(v_meeting->>'assignedToUserId'), '');
    IF v_id IS NOT NULL THEN v_collaborators := array_append(v_collaborators, v_id); END IF;
    IF jsonb_typeof(v_meeting->'participantUserIds') = 'array' THEN
      SELECT v_collaborators || COALESCE(array_agg(btrim(value::text)), '{}')
      INTO v_collaborators
      FROM jsonb_array_elements_text(v_meeting->'participantUserIds') AS value
      WHERE btrim(value::text) <> '';
    END IF;
  END LOOP;

  IF NEW.owner_id IS NOT NULL THEN
    v_collaborators := array_remove(v_collaborators, NEW.owner_id);
  END IF;
  NEW.collaborator_ids := COALESCE(ARRAY(SELECT DISTINCT unnest(v_collaborators)), '{}');

  IF NEW.owner_id IS NOT NULL THEN
    SELECT p.team_id::TEXT, p.department_id::TEXT
    INTO v_team_id, v_department_id
    FROM public.profiles p
    WHERE p.legacy_user_id = NEW.owner_id
    LIMIT 1;
    IF v_team_id IS NOT NULL THEN
      NEW.team_id := v_team_id;
    END IF;
    IF v_department_id IS NOT NULL THEN
      NEW.department_id := v_department_id;
    END IF;
  ELSE
    NEW.team_id := NULLIF(btrim(NEW.entry->>'teamId'), '');
    NEW.department_id := NULLIF(btrim(NEW.entry->>'departmentId'), '');
  END IF;

  RETURN NEW;
END;
$$;
