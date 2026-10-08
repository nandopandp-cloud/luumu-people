# Pesquisas anônimas — arquitetura de anonimato

> Implementação: **Fase 4**. Este documento é o contrato que a implementação precisa cumprir. As regras que já valem desde a Fase 1 estão marcadas com ✅.

## Garantia

Nada **persistido** (banco, logs, traces, auditoria, exportações) liga uma pessoa à sua resposta de uma pesquisa anônima, e nenhuma role da aplicação lê respostas individuais. Isso vale para todos os papéis, inclusive Administrador e Super Admin.

- ✅ O catálogo de permissões não tem, e um teste garante que nunca terá, nenhuma capacidade de leitura individual de pesquisa anônima.
- ✅ A auditoria não registra envio de resposta anônima, e os metadados com `answer`/`response` são descartados.
- ✅ O logger redige `answers` e `comment`.

## Separação participação × resposta

```
schema public (core)                       schema survey_vault
──────────────────────                     ─────────────────────────────
survey_invitation                          anon_submission_buffer
  campaign_id, recipient_id,                 campaign_id, dimensions, answers
  status, completed_on (só DATA)           anon_response  (UUIDv4, SEM timestamp)
                                           anon_answer
       ✗ sem FK, sem id compartilhado ✗    anon_response_dimension (dimensões generalizadas)
```

- O cofre não tem colunas de identidade, timestamps nem FK para o `core`. Testes de introspecção do schema falham o CI se isso mudar.
- Nenhuma role de runtime tem `SELECT` nas tabelas do cofre. O acesso é só por funções `SECURITY DEFINER`:
  - `survey_vault.submit(...)` (insere no buffer);
  - `survey_vault.flush(...)`;
  - `survey_vault.aggregate(...)` (devolve só agregados ou `suppressed`).

## Envio

1. O colaborador autenticado abre a pesquisa e a API valida o convite (pendente, no prazo, no público).
2. Na transação 1 (core), o convite é marcado como concluído, guardando **só a data**. Isso garante resposta única.
3. Em memória, a API deriva as dimensões generalizadas aprovadas para a campanha (ex.: diretoria, faixa de tempo de casa) e descarta a identidade.
4. Na transação 2 (cofre), a resposta entra no **buffer**.
5. Quando o buffer de uma campanha chega a ≥ k itens (ou no encerramento), o *flush* move as respostas **em ordem aleatória** para as tabelas finais, numa única transação, e esvazia o buffer.

O passo 5 existe porque o Postgres registra a ordem física e o id de transação (`ctid`, `xmin`) de cada linha. Gravar direto permitiria correlacionar a ordem das respostas com a ordem das conclusões dos convites. Na Vercel não há worker contínuo: o flush roda dentro da própria requisição que completa o lote, e um cron diário cobre as campanhas encerradas.

## Leitura e k-anonimato

- k ∈ {5, 7, 10} por empresa. O piso de 5 está em constraint de banco (`organizations_anonymity_k_check`) ✅. O k da campanha congela no lançamento e **só pode aumentar**.
- **Supressão primária:** uma célula só aparece se tiver ≥ k respostas.
- **Supressão complementar:** uma célula só aparece se o *complemento* dentro do grupo pai também for 0 ou ≥ k. Isso bloqueia o ataque por diferença: Produto = 6, Produto∧Head = 5, logo Produto∖Head = 1.
- Máximo de 2 dimensões combinadas, e só dimensões aprovadas no lançamento. Valores com menos de k convidados são generalizados ("Outros") ou removidos.
- Os resultados são liberados em **lotes** (nunca a cada resposta), o que impede inferir a resposta de alguém olhando o contador mudar.
- O gestor passa pelo mesmo caminho: escopo da equipe **e** k. Equipe de 3 pessoas → `suppressed`.
- Exportações usam as mesmas funções. Não existe exportação bruta de pesquisa anônima.

Texto exibido quando um resultado é suprimido: *"Ainda não temos respostas suficientes para mostrar este resultado preservando o anonimato."*

## Comentários

- Aviso no formulário: *"Sua resposta é anônima. Evite inserir informações que possam identificar você ou outra pessoa."*
- Exibidos só para grupos com ≥ k, em ordem aleatória, sem data e sem dimensões.
- A análise por IA recebe só o texto, com PII redigida (nomes do diretório → `[PESSOA]`), e nunca tenta identificar autoria.

## Observabilidade

A rota de envio não loga request, payload nem usuário, e não gera spans com atributos. Não guarda IP, user-agent ou fingerprint ligados à resposta. Páginas de pesquisa não têm scripts de terceiros (✅ a CSP global já bloqueia qualquer origem externa), session replay nem rascunho no servidor (só `sessionStorage`).

## Imutabilidade

Um trigger impede mudar `anonymity_mode` depois do lançamento. Pesquisas **identificadas** usam tabelas próprias (`survey_identified_response`) e a interface informa *"Esta pesquisa é identificada"*.

## Risco residual (documentado)

Durante o processamento da requisição de envio, o processo da aplicação vê sessão e respostas em memória (nada disso é persistido). Um DBA com acesso físico poderia inspecionar o buffer antes do flush. Hardening futuro: tokens com **assinatura cega (RFC 9474)** e o cofre em uma instância de banco separada.

## Testes obrigatórios (Fase 4)

1. Admin/Super Admin tentando ler resposta individual (API, export, SQL com role da app) → negado.
2. Equipe com 3 pessoas → `suppressed`.
3. Combinação de filtros e ataque por diferença → `suppressed`.
4. Inversão Survey → Response → User: introspecção (sem identidade, sem timestamp, sem FK), grants e ordem física pós-flush não correlacionada.
5. String sentinela enviada numa resposta não aparece em logs, traces nem auditoria.
6. `anonymity_mode` ou k reduzidos após o lançamento → rejeitados.
