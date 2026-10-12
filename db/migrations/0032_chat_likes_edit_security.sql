-- =============================================================================
-- 0032 — Curtidas e edição de mensagens do chat.
--
-- Curtir: só em mensagens que a pessoa vê (a subconsulta respeita a RLS de
-- chat_messages: participante, a partir da própria entrada) e em nome próprio.
-- Editar: só quem enviou (policy own_message_update de 0030), só o texto, só
-- enquanto a mensagem não foi apagada; o banco marca `edited_at`.
-- `updated_at` muda a cada edição, exclusão ou curtida: é o que a atualização
-- periódica do chat consulta.
-- =============================================================================
ALTER TABLE public.chat_message_likes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.chat_message_likes TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY visible_message ON public.chat_message_likes AS RESTRICTIVE TO luumu_app
  USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.tenant_id = chat_message_likes.tenant_id AND m.id = chat_message_likes.message_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.tenant_id = chat_message_likes.tenant_id AND m.id = chat_message_likes.message_id AND m.deleted_at IS NULL));
--> statement-breakpoint
CREATE POLICY own_like_insert ON public.chat_message_likes AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY own_like_delete ON public.chat_message_likes AS RESTRICTIVE FOR DELETE TO luumu_app
  USING (user_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.chat_message_likes TO luumu_app;
--> statement-breakpoint

-- Regras de alteração de mensagens (substitui chat_messages_delete_only):
--  * apagada não muda mais (texto, anexo e exclusão);
--  * o anexo não é trocado (só descartado ao apagar);
--  * texto alterado em mensagem não apagada = edição (edited_at pelo banco);
--  * updated_at sempre pelo banco.
DROP TRIGGER chat_messages_delete_only ON public.chat_messages;
--> statement-breakpoint
DROP FUNCTION app.chat_messages_delete_only();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.chat_messages_guard() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, app
  AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND (NEW.body IS DISTINCT FROM OLD.body OR NEW.file_id IS DISTINCT FROM OLD.file_id OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) THEN
    RAISE EXCEPTION 'mensagem apagada não pode ser alterada';
  END IF;
  IF NEW.deleted_at IS NULL AND NEW.file_id IS DISTINCT FROM OLD.file_id THEN
    RAISE EXCEPTION 'o anexo da mensagem não pode ser trocado';
  END IF;
  IF NEW.deleted_at IS NULL AND NEW.body IS DISTINCT FROM OLD.body THEN
    NEW.edited_at := now();
  ELSE
    NEW.edited_at := OLD.edited_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER chat_messages_guard BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION app.chat_messages_guard();
--> statement-breakpoint

-- Curtir/descurtir marca a mensagem como alterada (o runtime não tem grant em
-- updated_at; a função roda como dona do schema e só toca essa coluna).
CREATE OR REPLACE FUNCTION app.chat_message_likes_touch() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, app
  AS $$
DECLARE
  target uuid := coalesce(NEW.message_id, OLD.message_id);
  tenant uuid := coalesce(NEW.tenant_id, OLD.tenant_id);
BEGIN
  UPDATE public.chat_messages SET updated_at = now() WHERE tenant_id = tenant AND id = target;
  RETURN NULL;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.chat_message_likes_touch() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER chat_message_likes_touch AFTER INSERT OR DELETE ON public.chat_message_likes
  FOR EACH ROW EXECUTE FUNCTION app.chat_message_likes_touch();
