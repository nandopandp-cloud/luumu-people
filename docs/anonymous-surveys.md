# Pesquisas anônimas — arquitetura de anonimato

> Implementação: **entregue em 2026-10-08** (migration `0012_surveys_security`, `src/server/modules/surveys`). Este documento é o contrato que a implementação cumpre; as decisões e limites desta versão estão em [Implementação atual](#implementação-atual). Regras cobertas por teste estão marcadas com ✅.

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

## Implementação atual

| Tema | Como está | Teste |
|---|---|---|
| Cofre | Schema `survey_vault` com `anon_submission_buffer`, `anon_response`, `anon_answer`, `anon_response_dimension`. Sem identidade, timestamp ou FK para o core; RLS habilitada sem policy; nenhuma role de runtime tem grant nas tabelas | ✅ `tests/integration/surveys.test.ts` (TESTE 4) |
| Acesso | A role `luumu_app` tem só `EXECUTE` em `submit`, `close`, `results` e `breakdown` (`SECURITY DEFINER`, validam o tenant da sessão). As funções internas `_flush`, `_buckets` e `_survey_k` não têm grant. Não há roles `luumu_vault_writer/reader` separadas: a separação da RFC foi substituída por "nenhum grant de tabela + só funções" | ✅ TESTE 1 |
| Envio | Tx 1 (core): valida convite e respostas, deriva as dimensões e marca o convite com a **data**. Tx 2 (sem usuário no contexto): `survey_vault.submit`. Se a Tx 2 falhar, o convite volta a pendente; o erro do banco não é logado | ✅ lotes/resposta única |
| Lotes | O flush roda dentro do envio que completa k itens no buffer e no encerramento; move em ordem aleatória (`ORDER BY random()`) com UUIDv4 novos | ✅ resultados só mudam a cada k |
| Encerramento | Manual (`survey.launch`) ou automático: pesquisas vencidas são encerradas, e o buffer liberado, antes de qualquer leitura da gestão (não há cron nesta versão) | — |
| k | Padrão da empresa (piso 5); a pesquisa pode subir para 7 ou 10. Congela no lançamento; trigger impede reduzir | ✅ TESTE 6 |
| Dimensões | `diretoria`, `area` e `tempo_de_casa`, aprovadas no lançamento só com valores de ≥ k convidados (o resto vira "Outros"; dimensão com < 2 valores é descartada) | ✅ TESTES 2 e 3 |
| Supressão | Leitura por **uma** dimensão por vez (mais restrito que o limite de 2). `_buckets` junta em "Outros" os grupos com < k e, se "Outros" ficar entre 1 e k−1, absorve os menores grupos até chegar a k. Todo grupo exibido e todo complemento têm ≥ k (supressão complementar). Pergunta com < k respostas no grupo mostra só a contagem | ✅ TESTES 2 e 3 |
| Comentários | Devolvidos só com ≥ k respostas no grupo, em ordem aleatória, sem data nem dimensão | ✅ |
| Observabilidade | A rota de envio usa `defineRoute({ anonymous: true })`: rate limit só em memória volátil e, em erro inesperado, log apenas com `requestId`. Nada é auditado no envio | ✅ TESTE 5 |
| Rascunho | Somente `sessionStorage` do navegador; apagado ao enviar | — |

**Ainda não implementado (próximas etapas):**

- Pesquisas **identificadas** (`survey_identified_response`, aviso na interface). Hoje toda pesquisa é anônima; a coluna `anonymity_mode` e o trigger de imutabilidade já existem.
- Resultados para **gestores com escopo de equipe** (exigem uma dimensão de equipe aprovada no lançamento, sempre com k). Hoje só quem tem `survey.results.read_aggregate` com escopo TENANT vê resultados.
- Público segmentado (hoje: todas as pessoas ativas), recorrência, lógica condicional entre perguntas e exportação (que usará as mesmas funções de agregação).
- Cron diário para encerrar pesquisas vencidas mesmo sem acesso à gestão.
- Teste estatístico de "ordem física pós-flush não correlacionada" (o embaralhamento existe, mas o teste automatizado não).

**Risco residual adicional:** no encerramento, o último lote pode ter menos que k respostas. Quem comparar os resultados antes e depois do encerramento vê o efeito desse lote menor. Mitigação futura: só liberar o último lote junto com o anterior, ou exibir resultados apenas após o encerramento.
