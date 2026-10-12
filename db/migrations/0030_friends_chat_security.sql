-- =============================================================================
-- 0030 — Amigos e conversas: RLS por tenant + policies RESTRICTIVE por pessoa.
--
-- Conversas são PRIVADAS: só quem participa lê participantes e mensagens, e
-- só as mensagens enviadas a partir da própria entrada. Nem a gestão nem
-- administradores têm caminho para ler conversas de outras pessoas.
--
-- A participação é conferida por funções SECURITY DEFINER no schema `app`
-- (uma policy de conversation_members que consultasse a própria tabela
-- entraria em recursão). Elas só respondem sobre a PRÓPRIA pessoa
-- (app.current_user_id()) no tenant atual.
-- =============================================================================

-- Desde quando a pessoa atual participa da conversa (NULL = não participa).
CREATE OR REPLACE FUNCTION app.chat_member_since(p_conversation uuid) RETURNS timestamptz
  LANGUAGE sql STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, app
  AS $$
    SELECT m.joined_at FROM public.conversation_members m
    WHERE m.tenant_id = app.current_tenant_id()
      AND m.conversation_id = p_conversation
      AND m.user_id = app.current_user_id()
      AND m.left_at IS NULL
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.chat_member_since(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.chat_member_since(uuid) TO luumu_app;
--> statement-breakpoint

-- A pessoa atual administra a conversa (grupo) e continua nela.
CREATE OR REPLACE FUNCTION app.chat_is_admin(p_conversation uuid) RETURNS boolean
  LANGUAGE sql STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, app
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.conversation_members m
      WHERE m.tenant_id = app.current_tenant_id()
        AND m.conversation_id = p_conversation
        AND m.user_id = app.current_user_id()
        AND m.role = 'admin'
        AND m.left_at IS NULL
    )
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.chat_is_admin(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.chat_is_admin(uuid) TO luumu_app;
--> statement-breakpoint

-- A pessoa atual criou a conversa (para entrar nela como primeira participante).
CREATE OR REPLACE FUNCTION app.chat_is_creator(p_conversation uuid) RETURNS boolean
  LANGUAGE sql STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, app
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.tenant_id = app.current_tenant_id()
        AND c.id = p_conversation
        AND c.created_by = app.current_user_id()
    )
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.chat_is_creator(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.chat_is_creator(uuid) TO luumu_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- friendships: pedido em nome próprio; aceitar só quem recebeu; desfazer, as duas partes.
-- Pedidos pendentes só são vistos pelas duas pessoas; amizades aceitas, pela empresa.
-- ---------------------------------------------------------------------------
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.friendships TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY friendship_select ON public.friendships AS RESTRICTIVE FOR SELECT TO luumu_app
  USING (status = 'accepted' OR requester_id = app.current_user_id() OR addressee_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY own_request_insert ON public.friendships AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (requester_id = app.current_user_id() AND status = 'pending' AND responded_at IS NULL);
--> statement-breakpoint
CREATE POLICY addressee_accepts ON public.friendships AS RESTRICTIVE FOR UPDATE TO luumu_app
  USING (addressee_id = app.current_user_id() AND status = 'pending')
  WITH CHECK (addressee_id = app.current_user_id() AND status = 'accepted');
--> statement-breakpoint
CREATE POLICY own_friendship_delete ON public.friendships AS RESTRICTIVE FOR DELETE TO luumu_app
  USING (requester_id = app.current_user_id() OR addressee_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.friendships TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (status, responded_at) ON public.friendships TO luumu_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- conversations: visível só para quem participa; criada em nome próprio;
-- nome do grupo alterado só pela administração do grupo. Nunca apagada pelo runtime.
-- ---------------------------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.conversations TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY member_select ON public.conversations AS RESTRICTIVE FOR SELECT TO luumu_app
  USING (app.chat_member_since(id) IS NOT NULL);
--> statement-breakpoint
CREATE POLICY own_conversation_insert ON public.conversations AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (created_by = app.current_user_id());
--> statement-breakpoint
CREATE POLICY admin_update ON public.conversations AS RESTRICTIVE FOR UPDATE TO luumu_app
  USING (app.chat_is_admin(id)) WITH CHECK (app.chat_is_admin(id));
--> statement-breakpoint
GRANT SELECT, INSERT ON public.conversations TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (title, updated_at) ON public.conversations TO luumu_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- conversation_members: quem participa vê os demais; quem cria entra primeiro
-- (como administração); a administração adiciona e remove; cada pessoa sai,
-- marca como lida e sinaliza "digitando" só por si (trigger abaixo).
-- ---------------------------------------------------------------------------
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.conversation_members TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY member_select ON public.conversation_members AS RESTRICTIVE FOR SELECT TO luumu_app
  USING (app.chat_member_since(conversation_id) IS NOT NULL);
--> statement-breakpoint
CREATE POLICY member_insert ON public.conversation_members AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (
    (user_id = app.current_user_id() AND role = 'admin' AND app.chat_is_creator(conversation_id))
    OR app.chat_is_admin(conversation_id)
  );
--> statement-breakpoint
CREATE POLICY member_update ON public.conversation_members AS RESTRICTIVE FOR UPDATE TO luumu_app
  USING (user_id = app.current_user_id() OR app.chat_is_admin(conversation_id))
  WITH CHECK (user_id = app.current_user_id() OR app.chat_is_admin(conversation_id));
--> statement-breakpoint
GRANT SELECT, INSERT ON public.conversation_members TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (role, joined_at, left_at, last_read_at, typing_at) ON public.conversation_members TO luumu_app;
--> statement-breakpoint
-- Colunas por papel: papel, entrada e reentrada só pela administração; leitura e
-- "digitando" só pela própria pessoa. Vale para o runtime (luumu_app).
CREATE OR REPLACE FUNCTION app.conversation_members_guard() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, app
  AS $$
BEGIN
  IF current_user = 'luumu_app' THEN
    IF (NEW.role IS DISTINCT FROM OLD.role
        OR NEW.joined_at IS DISTINCT FROM OLD.joined_at
        OR (OLD.left_at IS NOT NULL AND NEW.left_at IS NULL))
       AND NOT app.chat_is_admin(NEW.conversation_id) THEN
      RAISE EXCEPTION 'somente a administração do grupo altera papéis e entradas';
    END IF;
    IF NEW.user_id IS DISTINCT FROM app.current_user_id()
       AND (NEW.last_read_at IS DISTINCT FROM OLD.last_read_at OR NEW.typing_at IS DISTINCT FROM OLD.typing_at) THEN
      RAISE EXCEPTION 'leitura e digitação só em nome próprio';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER conversation_members_guard BEFORE UPDATE ON public.conversation_members
  FOR EACH ROW EXECUTE FUNCTION app.conversation_members_guard();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- chat_messages: lidas por quem participa (desde a própria entrada); enviadas
-- em nome próprio por quem participa; só quem enviou apaga (sem edição).
-- ---------------------------------------------------------------------------
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.chat_messages TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY member_select ON public.chat_messages AS RESTRICTIVE FOR SELECT TO luumu_app
  USING (created_at >= app.chat_member_since(conversation_id));
--> statement-breakpoint
CREATE POLICY own_message_insert ON public.chat_messages AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (sender_id = app.current_user_id() AND app.chat_member_since(conversation_id) IS NOT NULL);
--> statement-breakpoint
CREATE POLICY own_message_update ON public.chat_messages AS RESTRICTIVE FOR UPDATE TO luumu_app
  USING (sender_id = app.current_user_id()) WITH CHECK (sender_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON public.chat_messages TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (body, file_id, deleted_at) ON public.chat_messages TO luumu_app;
--> statement-breakpoint
-- Mensagens não são editadas: a única alteração é apagar (uma vez), descartando o conteúdo.
CREATE OR REPLACE FUNCTION app.chat_messages_delete_only() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, app
  AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN
    RAISE EXCEPTION 'mensagens não podem ser editadas, só apagadas';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER chat_messages_delete_only BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION app.chat_messages_delete_only();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- user_presence: "online agora". Cada pessoa grava só o próprio sinal.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.user_presence TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY own_presence_insert ON public.user_presence AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY own_presence_update ON public.user_presence AS RESTRICTIVE FOR UPDATE TO luumu_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON public.user_presence TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (last_seen_at) ON public.user_presence TO luumu_app;
