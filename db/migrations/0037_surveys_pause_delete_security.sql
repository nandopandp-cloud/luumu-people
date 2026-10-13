-- =============================================================================
-- 0037 — Pesquisas: pausar/retomar e excluir pesquisa já lançada.
--  * Ciclo: draft → active ⇄ paused → closed (active → closed continua valendo).
--    Pausada não recebe respostas (survey_vault.submit exige 'active').
--  * Perguntas, modo de anonimato, dimensões e k (só sobe) seguem congelados.
--  * A role de runtime só apaga RASCUNHOS. Pesquisa lançada é apagada apenas
--    por survey_vault.purge (SECURITY DEFINER), que remove junto, no cofre, as
--    respostas anônimas e o buffer — nada fica órfão, nada é lido.
-- =============================================================================
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

-- Exclui uma pesquisa lançada do tenant da sessão e TODAS as respostas dela no
-- cofre. Não devolve nada sobre as respostas (nem contagem).
CREATE OR REPLACE FUNCTION survey_vault.purge(p_survey uuid) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = p_survey AND s.tenant_id = app.current_tenant_id() AND s.status <> 'draft') THEN
    RAISE EXCEPTION 'pesquisa não encontrada' USING ERRCODE = 'no_data_found';
  END IF;
  DELETE FROM survey_vault.anon_submission_buffer b WHERE b.survey_id = p_survey;
  -- anon_answer e anon_response_dimension caem em cascata.
  DELETE FROM survey_vault.anon_response r WHERE r.survey_id = p_survey;
  -- Convites e perguntas caem em cascata.
  DELETE FROM public.surveys s WHERE s.id = p_survey AND s.tenant_id = app.current_tenant_id();
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION survey_vault.purge(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION survey_vault.purge(uuid) TO luumu_app;
