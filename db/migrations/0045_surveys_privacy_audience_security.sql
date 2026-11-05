-- =============================================================================
-- 0045 — Pesquisas: privacidade escolhida por quem cria, pesquisa livre e público
-- por várias áreas (docs/anonymous-surveys.md).
--  - anonymity_mode ('anonymous' | 'identified') e no_minimum (pesquisa livre)
--    são definidos no rascunho e CONGELAM no lançamento.
--  - Anônima e livre: o cofre usa k = 1 (libera desde a 1ª resposta) e não há
--    dimensões aprovadas, logo nenhum recorte por grupo.
--  - Identificada: respostas em survey_identified_responses, somente inserção,
--    e só pela própria pessoa (policy RESTRICTIVE), com a pesquisa aberta.
--  - survey_audience_units: uma ou mais áreas; gravado só no rascunho (no
--    lançamento) e congelado depois.
-- =============================================================================
GRANT UPDATE (anonymity_mode, no_minimum) ON public.surveys TO luumu_app;
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
  IF NEW.no_minimum IS DISTINCT FROM OLD.no_minimum AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'no_minimum é imutável após o lançamento' USING ERRCODE = 'insufficient_privilege';
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
  -- Pesquisa livre nunca tem recortes por grupo: sem k, um recorte expõe pessoas.
  IF NEW.no_minimum AND NEW.dimensions <> '{}'::jsonb THEN
    RAISE EXCEPTION 'pesquisa livre não tem recortes por grupo' USING ERRCODE = 'check_violation';
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

-- ------------------------------------------------------------ público (áreas)
ALTER TABLE public.survey_audience_units ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.survey_audience_units TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON public.survey_audience_units TO luumu_app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.survey_audience_units_guard() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_status text;
BEGIN
  SELECT s.status INTO v_status FROM public.surveys s WHERE s.id = coalesce(NEW.survey_id, OLD.survey_id);
  -- v_status nulo: a própria pesquisa está sendo apagada em cascata.
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'o público congela no lançamento' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;
--> statement-breakpoint
CREATE TRIGGER survey_audience_units_guard BEFORE INSERT OR UPDATE OR DELETE ON public.survey_audience_units
  FOR EACH ROW EXECUTE FUNCTION app.survey_audience_units_guard();
--> statement-breakpoint

-- ------------------------------------------------- respostas identificadas
ALTER TABLE public.survey_identified_responses ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.survey_identified_responses TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
-- Ninguém responde em nome de outra pessoa.
CREATE POLICY own_insert_only ON public.survey_identified_responses AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
-- Somente inserção: sem UPDATE nem DELETE para o runtime.
GRANT SELECT, INSERT ON public.survey_identified_responses TO luumu_app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.survey_identified_responses_guard() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = NEW.survey_id AND s.tenant_id = NEW.tenant_id
      AND s.anonymity_mode = 'identified' AND s.status = 'active'
      AND s.launched_at <= now() AND s.closes_at > now()
  ) THEN
    RAISE EXCEPTION 'pesquisa identificada indisponível' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.survey_invitations i WHERE i.survey_id = NEW.survey_id AND i.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'pessoa fora do público da pesquisa' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER survey_identified_responses_guard BEFORE INSERT ON public.survey_identified_responses
  FOR EACH ROW EXECUTE FUNCTION app.survey_identified_responses_guard();
--> statement-breakpoint

-- ------------------------------------------------------------------ cofre
-- k efetivo: 1 na pesquisa anônima LIVRE (resultados desde a 1ª resposta).
-- Identificada nunca passa pelo cofre (anonymity_mode = 'anonymous' exigido).
CREATE OR REPLACE FUNCTION survey_vault._survey_k(p_survey uuid) RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
  SELECT CASE WHEN s.no_minimum THEN 1 ELSE s.anonymity_k END FROM public.surveys s
  WHERE s.id = p_survey AND s.tenant_id = app.current_tenant_id() AND s.anonymity_mode = 'anonymous' AND s.status <> 'draft'
$$;
--> statement-breakpoint
-- Igual à 0041, com o k efetivo (livre = lote de 1).
CREATE OR REPLACE FUNCTION survey_vault.submit(p_survey uuid, p_dimensions jsonb, p_answers jsonb) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
DECLARE
  v_k integer;
BEGIN
  SELECT CASE WHEN s.no_minimum THEN 1 ELSE s.anonymity_k END INTO v_k FROM public.surveys s
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
