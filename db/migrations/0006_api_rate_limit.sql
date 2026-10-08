-- Rate limit da API compartilhado entre todas as instâncias (serverless).
-- Tabela no schema interno `app`: nenhuma role de runtime tem acesso direto;
-- o único caminho é a função SECURITY DEFINER abaixo (contagem atômica).
CREATE TABLE app.rate_limit_buckets (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  reset_at timestamptz NOT NULL
);
--> statement-breakpoint
REVOKE ALL ON app.rate_limit_buckets FROM PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.rate_limit_hit(p_key text, p_window_ms integer)
  RETURNS TABLE (hits integer, reset_at timestamptz)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, app
  AS $$
BEGIN
  IF length(p_key) > 200 OR p_window_ms < 1000 OR p_window_ms > 86400000 THEN
    RAISE EXCEPTION 'parâmetros de rate limit inválidos';
  END IF;
  -- Limpeza oportunista de janelas expiradas (~1% das chamadas).
  IF random() < 0.01 THEN
    DELETE FROM app.rate_limit_buckets b WHERE b.reset_at < now();
  END IF;
  RETURN QUERY
  INSERT INTO app.rate_limit_buckets AS b (key, hits, reset_at)
  VALUES (p_key, 1, now() + make_interval(secs => p_window_ms / 1000.0))
  ON CONFLICT (key) DO UPDATE SET
    hits = CASE WHEN b.reset_at <= now() THEN 1 ELSE b.hits + 1 END,
    reset_at = CASE WHEN b.reset_at <= now() THEN now() + make_interval(secs => p_window_ms / 1000.0) ELSE b.reset_at END
  RETURNING b.hits, b.reset_at;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.rate_limit_hit(text, integer) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.rate_limit_hit(text, integer) TO luumu_app;
