-- =============================================================================
-- 0041 — Pesquisas: público por área e agendamento (docs/anonymous-surveys.md).
--  - audience_org_unit_id: gravável pela aplicação, mas CONGELA no lançamento
--    (mesma regra de k e dimensões).
--  - Agendamento: launched_at no futuro. O cofre só aceita respostas a partir
--    dele — a aplicação também confere, mas a garantia fica no banco.
-- =============================================================================
GRANT UPDATE (audience_org_unit_id) ON public.surveys TO luumu_app;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.surveys_guard() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Dentro de survey_vault.purge o usuário efetivo é o dono do schema.
    IF OLD.status <> 'draft' AND current_user = 'luumu_app' THEN
      RAISE EXCEPTION 'pesquisa lançada não pode ser excluída' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.anonymity_mode IS DISTINCT FROM OLD.anonymity_mode AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'anonymity_mode é imutável após o lançamento' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.status <> 'draft' AND NEW.anonymity_k < OLD.anonymity_k THEN
    RAISE EXCEPTION 'o k de uma pesquisa lançada só pode aumentar' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.status <> 'draft' AND NEW.dimensions IS DISTINCT FROM OLD.dimensions THEN
    RAISE EXCEPTION 'dimensões congelam no lançamento' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.status <> 'draft' AND NEW.audience_org_unit_id IS DISTINCT FROM OLD.audience_org_unit_id THEN
    RAISE EXCEPTION 'o público congela no lançamento' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT (
    NEW.status = OLD.status
    OR (OLD.status = 'draft' AND NEW.status = 'active')
    OR (OLD.status = 'active' AND NEW.status IN ('paused', 'closed'))
    OR (OLD.status = 'paused' AND NEW.status IN ('active', 'closed'))
  ) THEN
    RAISE EXCEPTION 'transição de status inválida: % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'draft' AND NEW.status = 'active'
     AND NEW.anonymity_k < (SELECT o.anonymity_k FROM public.organizations o WHERE o.id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'o k da pesquisa não pode ser menor que o da empresa' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- Igual à 0012, mais: só depois do início (pesquisa agendada não recebe respostas).
CREATE OR REPLACE FUNCTION survey_vault.submit(p_survey uuid, p_dimensions jsonb, p_answers jsonb) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
DECLARE
  v_k integer;
BEGIN
  SELECT s.anonymity_k INTO v_k FROM public.surveys s
   WHERE s.id = p_survey AND s.tenant_id = app.current_tenant_id()
     AND s.status = 'active' AND s.anonymity_mode = 'anonymous'
     AND s.launched_at <= now() AND s.closes_at > now();
  IF v_k IS NULL THEN
    RAISE EXCEPTION 'pesquisa indisponível' USING ERRCODE = 'no_data_found';
  END IF;
  IF jsonb_typeof(p_dimensions) IS DISTINCT FROM 'object' OR jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'envio inválido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO survey_vault.anon_submission_buffer (survey_id, dimensions, answers) VALUES (p_survey, p_dimensions, p_answers);
  IF (SELECT count(*) FROM survey_vault.anon_submission_buffer b WHERE b.survey_id = p_survey) >= v_k THEN
    PERFORM survey_vault._flush(p_survey);
  END IF;
END
$$;
