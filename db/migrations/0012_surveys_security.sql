-- =============================================================================
-- 0012 — Segurança de pesquisas e comunicados (Fases 2 e 4).
--
-- CORE (public): RLS por tenant + grants por coluna + travas de imutabilidade.
-- COFRE (survey_vault): respostas anônimas sem identidade, sem timestamp e sem
-- FK para o core. NENHUMA role de runtime tem privilégio nas tabelas do cofre:
-- o único acesso é por funções SECURITY DEFINER (submit, close, results,
-- breakdown), que devolvem só agregados com supressão por k.
-- Contrato: docs/anonymous-surveys.md.
-- =============================================================================

-- ------------------------------------------------------------------ comunicados
GRANT UPDATE (pinned) ON public.announcements TO luumu_app;
--> statement-breakpoint

-- ------------------------------------------------------------------ core
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.surveys TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.survey_questions TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.survey_invitations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.survey_invitations TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
-- anonymity_mode NÃO é atualizável pelo runtime (nem em rascunho).
GRANT SELECT, INSERT, DELETE ON public.surveys TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (title, description, kind, status, anonymity_k, dimensions, closes_at, launched_at, closed_at, updated_at) ON public.surveys TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.survey_questions TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (position, type, text, options, required) ON public.survey_questions TO luumu_app;
--> statement-breakpoint
-- Convites: sem DELETE (histórico de participação) e só status/data atualizáveis.
GRANT SELECT, INSERT ON public.survey_invitations TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (status, completed_on) ON public.survey_invitations TO luumu_app;
--> statement-breakpoint

-- Travas: depois do lançamento, modo de anonimato, dimensões e perguntas
-- congelam; k só sobe; o ciclo é draft → active → closed; só rascunho é apagado.
CREATE OR REPLACE FUNCTION app.surveys_guard() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
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
  IF NOT (NEW.status = OLD.status OR (OLD.status = 'draft' AND NEW.status = 'active') OR (OLD.status = 'active' AND NEW.status = 'closed')) THEN
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
CREATE TRIGGER surveys_guard BEFORE UPDATE OR DELETE ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION app.surveys_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.survey_questions_guard() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_status text;
BEGIN
  SELECT s.status INTO v_status FROM public.surveys s WHERE s.id = coalesce(NEW.survey_id, OLD.survey_id);
  -- v_status nulo: a própria pesquisa (rascunho) está sendo apagada em cascata.
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'perguntas congelam no lançamento' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;
--> statement-breakpoint
CREATE TRIGGER survey_questions_guard BEFORE INSERT OR UPDATE OR DELETE ON public.survey_questions
  FOR EACH ROW EXECUTE FUNCTION app.survey_questions_guard();
--> statement-breakpoint

-- ------------------------------------------------------------------ cofre
CREATE SCHEMA IF NOT EXISTS survey_vault;
--> statement-breakpoint
REVOKE ALL ON SCHEMA survey_vault FROM PUBLIC;
--> statement-breakpoint
-- USAGE só para enxergar as funções; nenhuma tabela do cofre tem grant.
GRANT USAGE ON SCHEMA survey_vault TO luumu_app;
--> statement-breakpoint
-- Buffer: respostas aguardando o lote. Sem identidade e sem timestamp.
CREATE TABLE survey_vault.anon_submission_buffer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL,
  dimensions jsonb NOT NULL,
  answers jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX anon_submission_buffer_survey_idx ON survey_vault.anon_submission_buffer (survey_id);
--> statement-breakpoint
-- Resposta final: UUIDv4 aleatório, sem timestamp, sem FK para o core.
CREATE TABLE survey_vault.anon_response (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL
);
--> statement-breakpoint
CREATE INDEX anon_response_survey_idx ON survey_vault.anon_response (survey_id);
--> statement-breakpoint
CREATE TABLE survey_vault.anon_answer (
  response_id uuid NOT NULL REFERENCES survey_vault.anon_response (id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  value_num smallint,
  value_text text,
  PRIMARY KEY (response_id, question_id),
  CONSTRAINT anon_answer_one_value CHECK (num_nonnulls(value_num, value_text) = 1),
  CONSTRAINT anon_answer_text_length CHECK (length(value_text) <= 2000)
);
--> statement-breakpoint
CREATE INDEX anon_answer_question_idx ON survey_vault.anon_answer (question_id);
--> statement-breakpoint
-- Dimensões JÁ generalizadas (ex.: diretoria, faixa de tempo de casa).
CREATE TABLE survey_vault.anon_response_dimension (
  response_id uuid NOT NULL REFERENCES survey_vault.anon_response (id) ON DELETE CASCADE,
  dimension text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (response_id, dimension)
);
--> statement-breakpoint
-- Defesa em profundidade: RLS sem policy (nega tudo a quem não é dono).
ALTER TABLE survey_vault.anon_submission_buffer ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE survey_vault.anon_response ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE survey_vault.anon_answer ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE survey_vault.anon_response_dimension ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA survey_vault FROM PUBLIC;
--> statement-breakpoint

-- Move o buffer de uma pesquisa para as tabelas finais EM ORDEM ALEATÓRIA,
-- numa única transação. O DELETE ... RETURNING trava as linhas: dois flushes
-- concorrentes não duplicam respostas.
CREATE OR REPLACE FUNCTION survey_vault._flush(p_survey uuid) RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
DECLARE
  v_items jsonb;
  v_item jsonb;
  v_id uuid;
  v_count integer := 0;
BEGIN
  WITH moved AS (
    DELETE FROM survey_vault.anon_submission_buffer b WHERE b.survey_id = p_survey RETURNING b.dimensions, b.answers
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('d', m.dimensions, 'a', m.answers) ORDER BY random()), '[]'::jsonb) INTO v_items FROM moved m;

  FOR v_item IN SELECT e.value FROM jsonb_array_elements(v_items) WITH ORDINALITY AS e(value, n) ORDER BY e.n LOOP
    v_id := gen_random_uuid();
    INSERT INTO survey_vault.anon_response (id, survey_id) VALUES (v_id, p_survey);
    INSERT INTO survey_vault.anon_answer (response_id, question_id, value_num, value_text)
      SELECT v_id, a.key::uuid,
             CASE WHEN jsonb_typeof(a.value) = 'number' THEN (a.value #>> '{}')::smallint END,
             CASE WHEN jsonb_typeof(a.value) = 'string' THEN a.value #>> '{}' END
      FROM jsonb_each(v_item -> 'a') a
      WHERE jsonb_typeof(a.value) IN ('number', 'string');
    INSERT INTO survey_vault.anon_response_dimension (response_id, dimension, value)
      SELECT v_id, d.key, d.value #>> '{}' FROM jsonb_each(v_item -> 'd') d WHERE jsonb_typeof(d.value) = 'string';
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END
$$;
--> statement-breakpoint
-- Envio anônimo. Valida a pesquisa no tenant da sessão; o lote é liberado
-- quando o buffer chega a k. Não devolve nada (nem contagem).
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
     AND s.status = 'active' AND s.anonymity_mode = 'anonymous' AND s.closes_at > now();
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
--> statement-breakpoint
-- Encerramento: libera o que restou no buffer (a pesquisa já deve estar encerrada).
CREATE OR REPLACE FUNCTION survey_vault.close(p_survey uuid) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = p_survey AND s.tenant_id = app.current_tenant_id() AND s.status = 'closed') THEN
    RAISE EXCEPTION 'pesquisa não encerrada' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM survey_vault._flush(p_survey);
END
$$;
--> statement-breakpoint
-- Generalização de uma dimensão para leitura: valores com < k respostas vão
-- para "Outros"; se "Outros" ficar entre 1 e k-1, absorve os menores grupos
-- até chegar a k. Assim TODO grupo exibido tem ≥ k e o complemento de qualquer
-- grupo (a soma dos demais) também — supressão complementar.
CREATE OR REPLACE FUNCTION survey_vault._buckets(p_survey uuid, p_dimension text, p_k integer)
  RETURNS TABLE (value text, bucket text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
DECLARE
  v_counts jsonb;
  v_other integer;
  v_merge text[] := '{}';
  v_rec record;
BEGIN
  SELECT coalesce(jsonb_object_agg(c.value, c.n), '{}'::jsonb) INTO v_counts FROM (
    SELECT d.value, count(*)::int AS n
    FROM survey_vault.anon_response_dimension d
    JOIN survey_vault.anon_response r ON r.id = d.response_id
    WHERE r.survey_id = p_survey AND d.dimension = p_dimension
    GROUP BY d.value
  ) c;
  SELECT coalesce(sum(e.value::int), 0) INTO v_other FROM jsonb_each_text(v_counts) e WHERE e.value::int < p_k OR e.key = 'Outros';
  FOR v_rec IN SELECT e.key, e.value::int AS n FROM jsonb_each_text(v_counts) e WHERE e.value::int >= p_k AND e.key <> 'Outros' ORDER BY e.value::int, e.key LOOP
    EXIT WHEN v_other = 0 OR v_other >= p_k;
    v_merge := v_merge || v_rec.key;
    v_other := v_other + v_rec.n;
  END LOOP;
  RETURN QUERY
    SELECT e.key, CASE WHEN e.value::int < p_k OR e.key = 'Outros' OR e.key = ANY (v_merge) THEN 'Outros' ELSE e.key END
    FROM jsonb_each_text(v_counts) e;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION survey_vault._survey_k(p_survey uuid) RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
  SELECT s.anonymity_k FROM public.surveys s
  WHERE s.id = p_survey AND s.tenant_id = app.current_tenant_id() AND s.anonymity_mode = 'anonymous' AND s.status <> 'draft'
$$;
--> statement-breakpoint
-- Grupos de uma dimensão aprovada, com contagem (todos ≥ k). Total < k → vazio.
CREATE OR REPLACE FUNCTION survey_vault.breakdown(p_survey uuid, p_dimension text) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
DECLARE
  v_k integer := survey_vault._survey_k(p_survey);
  v_result jsonb;
BEGIN
  IF v_k IS NULL THEN
    RAISE EXCEPTION 'pesquisa não encontrada' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (SELECT s.dimensions ? p_dimension FROM public.surveys s WHERE s.id = p_survey) THEN
    RAISE EXCEPTION 'dimensão não aprovada para esta pesquisa' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', g.bucket, 'responses', g.n) ORDER BY g.bucket = 'Outros', g.bucket), '[]'::jsonb) INTO v_result
  FROM (
    SELECT b.bucket, count(*)::int AS n
    FROM survey_vault.anon_response_dimension d
    JOIN survey_vault.anon_response r ON r.id = d.response_id
    JOIN survey_vault._buckets(p_survey, p_dimension, v_k) b ON b.value = d.value
    WHERE r.survey_id = p_survey AND d.dimension = p_dimension
    GROUP BY b.bucket
  ) g
  WHERE g.n >= v_k;
  RETURN v_result;
END
$$;
--> statement-breakpoint
-- Resultado agregado (total ou de UM grupo de uma dimensão aprovada).
-- Grupo com < k respostas → {"suppressed": true}. Pergunta respondida por < k
-- → só a contagem. Comentários: só com ≥ k, em ordem aleatória, sem atributos.
CREATE OR REPLACE FUNCTION survey_vault.results(p_survey uuid, p_dimension text DEFAULT NULL, p_bucket text DEFAULT NULL) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
DECLARE
  v_k integer := survey_vault._survey_k(p_survey);
  v_values text[];
  v_ids uuid[];
  v_n integer;
  v_questions jsonb;
BEGIN
  IF v_k IS NULL THEN
    RAISE EXCEPTION 'pesquisa não encontrada' USING ERRCODE = 'no_data_found';
  END IF;
  IF (p_dimension IS NULL) <> (p_bucket IS NULL) THEN
    RAISE EXCEPTION 'filtro incompleto' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_dimension IS NOT NULL THEN
    IF NOT (SELECT s.dimensions ? p_dimension FROM public.surveys s WHERE s.id = p_survey) THEN
      RAISE EXCEPTION 'dimensão não aprovada para esta pesquisa' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    SELECT array_agg(b.value) INTO v_values FROM survey_vault._buckets(p_survey, p_dimension, v_k) b WHERE b.bucket = p_bucket;
  END IF;

  SELECT array_agg(r.id) INTO v_ids FROM survey_vault.anon_response r
  WHERE r.survey_id = p_survey
    AND (p_dimension IS NULL OR EXISTS (
      SELECT 1 FROM survey_vault.anon_response_dimension d
      WHERE d.response_id = r.id AND d.dimension = p_dimension AND d.value = ANY (coalesce(v_values, '{}'))
    ));
  v_n := coalesce(cardinality(v_ids), 0);
  IF v_n < v_k THEN
    RETURN jsonb_build_object('suppressed', true);
  END IF;

  SELECT coalesce(jsonb_agg(t.q ORDER BY t.pos), '[]'::jsonb) INTO v_questions FROM (
    SELECT qq.position AS pos, jsonb_build_object(
      'questionId', qq.id,
      'answered', agg.n,
      'suppressed', agg.n < v_k,
      'average', CASE WHEN agg.n >= v_k AND qq.type IN ('scale', 'enps') THEN agg.avg END,
      'distribution', CASE WHEN agg.n >= v_k AND qq.type <> 'text' THEN agg.dist END,
      'comments', CASE WHEN agg.n >= v_k AND qq.type = 'text' THEN agg.comments END
    ) AS q
    FROM public.survey_questions qq
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS n,
             round(avg(a.value_num)::numeric, 2) AS avg,
             (SELECT jsonb_object_agg(x.v, x.c) FROM (
                SELECT a2.value_num::text AS v, count(*)::int AS c FROM survey_vault.anon_answer a2
                WHERE a2.question_id = qq.id AND a2.response_id = ANY (v_ids) AND a2.value_num IS NOT NULL GROUP BY 1
                UNION ALL
                SELECT a2.value_text, count(*)::int FROM survey_vault.anon_answer a2
                WHERE a2.question_id = qq.id AND a2.response_id = ANY (v_ids) AND a2.value_text IS NOT NULL AND qq.type = 'choice' GROUP BY 1
             ) x) AS dist,
             (SELECT jsonb_agg(c.value_text ORDER BY random()) FROM survey_vault.anon_answer c
              WHERE c.question_id = qq.id AND c.response_id = ANY (v_ids) AND c.value_text IS NOT NULL AND qq.type = 'text') AS comments
      FROM survey_vault.anon_answer a
      WHERE a.question_id = qq.id AND a.response_id = ANY (v_ids)
    ) agg
    WHERE qq.survey_id = p_survey
  ) t;

  RETURN jsonb_build_object('suppressed', false, 'responses', v_n, 'questions', v_questions);
END
$$;
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA survey_vault FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION survey_vault.submit(uuid, jsonb, jsonb) TO luumu_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION survey_vault.close(uuid) TO luumu_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION survey_vault.results(uuid, text, text) TO luumu_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION survey_vault.breakdown(uuid, text) TO luumu_app;
