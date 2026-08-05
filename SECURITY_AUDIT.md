# Auditoria de Segurança — ContractEase

**Data:** 05/08/2026
**Escopo:** aplicação web (React/Vite), camada de dados (Supabase/PostgREST + RLS),
10 Edge Functions (Deno) e 7 smart contracts Soroban (Rust).
**Método:** revisão de código (SAST manual) de 100% da superfície de ataque do
repositório — não houve teste dinâmico contra ambiente publicado (ver
[Limitações](#limitações-do-que-foi-feito)).

---

## Sumário executivo

Foram identificadas **35 vulnerabilidades**, sendo **9 críticas**. As mais graves
formam três cadeias de ataque que comprometem o produto de ponta a ponta:

| # | Cadeia | Impacto |
|---|--------|---------|
| 1 | **Monetização quebrada** — qualquer pessoa cria créditos e planos do nada, sem pagar | Perda de 100% da receita |
| 2 | **Tomada de conta e escalada a admin** — um usuário comum vira `admin` com uma requisição | Acesso total à base |
| 3 | **Adulteração da prova de existência** — atacante anônimo reescreve o hash ancorado de contratos alheios | Destrói o valor jurídico do produto |

O denominador comum: **as Edge Functions rodam com `service_role` (que ignora RLS)
mas quase nenhuma verificava quem estava chamando**, e o RLS de `profiles` permitia
que o próprio usuário editasse as colunas que definem seus privilégios.

**Status:** 28 das 35 corrigidas neste branch. As 7 restantes exigem decisão de
produto ou infraestrutura e estão documentadas com o caminho recomendado.

---

## Índice de achados

### Críticas (9)

| ID | Achado | Status |
|----|--------|--------|
| CRIT-01 | Escalada de privilégio: usuário se promove a `admin` e se dá créditos | ✅ Corrigido |
| CRIT-02 | Webhook de pagamento sem verificação de assinatura | ✅ Corrigido |
| CRIT-03 | Preço e quantidade de créditos definidos pelo cliente | ✅ Corrigido |
| CRIT-04 | Confirmação de pagamento Stellar não valida valor, ativo nem destinatário | ✅ Corrigido |
| CRIT-05 | `send-signing-email` como open relay de phishing | ✅ Corrigido |
| CRIT-06 | `anchor-on-stellar` anônima: adultera prova de contratos alheios | ✅ Corrigido |
| CRIT-07 | `deploy-soroban` anônima: drena a conta sponsor | ✅ Corrigido |
| CRIT-08 | OTP de 4 dígitos, sem rate limit e para qualquer `user_id` | ✅ Corrigido |
| CRIT-09 | Chave secreta Stellar em `localStorage` sem criptografia | ⚠️ Documentado |

### Altas (7)

| ID | Achado | Status |
|----|--------|--------|
| HIGH-01 | Dump de PII: e-mails e carteiras de toda a base via RPC | ✅ Corrigido |
| HIGH-02 | Estatísticas administrativas abertas a qualquer usuário logado | ✅ Corrigido |
| HIGH-03 | XSS via saída da IA (`dangerouslySetInnerHTML`) | ✅ Corrigido |
| HIGH-04 | `ai-agent` anônima: abuso da chave Gemini | ✅ Corrigido |
| HIGH-05 | Clickjacking na tela de assinatura (sem `frame-ancestors`) | ✅ Corrigido |
| HIGH-06 | CSP com `'unsafe-inline'` em `script-src` | ✅ Corrigido |
| HIGH-07 | Verificação de identidade do signatário só no cliente | ⚠️ Documentado |

### Web3 / Smart contracts (6)

| ID | Achado | Status |
|----|--------|--------|
| W3-01 | **Reentrância (violação de CEI) em 13 funções de 5 contratos** | ✅ Corrigido |
| W3-02 | `create` + `init` não atômicos: front-running da inicialização | ⚠️ Documentado |
| W3-03 | `rent::init` sem validar parâmetros (trava de fundos e multa sem teto) | ✅ Corrigido |
| W3-04 | `buy_shares` paga o sponsor direto, sem escrow | ⚠️ Documentado |
| W3-05 | Centralização: locador/sponsor decide sozinho sobre fundos de terceiros | ⚠️ Documentado |
| W3-06 | Contratos sem pausa de emergência nem caminho de upgrade | ⚠️ Documentado |

### Médias e baixas (13)

| ID | Achado | Status |
|----|--------|--------|
| MED-01 | Signatário podia reescrever e retrodatar metadados da própria assinatura | ✅ Corrigido |
| MED-02 | Injeção de filtro PostgREST via `.or()` com interpolação de string | ✅ Corrigido |
| MED-03 | Oráculo de enumeração de usuários por e-mail/carteira | ✅ Mitigado |
| MED-04 | `Access-Control-Allow-Origin: *` em todas as Edge Functions | ✅ Corrigido |
| MED-05 | Vazamento de detalhes internos em mensagens de erro | ✅ Corrigido |
| MED-06 | Corrida (read-modify-write) na contagem de créditos | ✅ Corrigido |
| MED-07 | SVG do QR Code de 2FA injetado sem sanitização | ✅ Corrigido |
| MED-08 | Ausência de HSTS, Referrer-Policy e Permissions-Policy | ✅ Corrigido |
| MED-09 | Memo de pagamento gerado com `Math.random()` | ✅ Corrigido |
| MED-10 | Scripts de CDN (iconify) sem Subresource Integrity | ⚠️ Documentado |
| LOW-01 | `/seed` acessível em produção | ⚠️ Documentado |
| LOW-02 | `httpClient.ts`: padrão de token em `localStorage` (código morto) | ⚠️ Documentado |
| LOW-03 | Ausência de rate limiting global nas Edge Functions | ⚠️ Parcial |

---

## Críticas — detalhamento

### CRIT-01 — Escalada de privilégio via `UPDATE` em `profiles`

**Onde:** `supabase/migrations/20260507130134_create_core_schema.sql:196`

```sql
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
```

A policy garante que você só edita a **sua** linha — mas não restringe **quais
colunas**. E a tabela `profiles` guarda justamente `role`, `credits` e `plan`.
Como o Supabase expõe `UPDATE` direto via PostgREST, bastava, no console do
navegador de uma conta comum:

```js
await supabase.from('profiles').update({
  role: 'admin', credits: 999999999, plan: 'enterprise'
}).eq('id', (await supabase.auth.getUser()).data.user.id);
```

**Impacto:** escalada a `admin`, créditos infinitos e plano pago grátis. Combina
com HIGH-02 (o painel administrativo só checava `user.role` no front — e o
próprio usuário passou a controlar esse valor).

**Correção:** trigger `guard_profile_privileged_columns` que congela
`role`, `credits`, `plan`, `organization_id`, `id`, `created_at` e `email` para
quem não é `service_role`, e policy de `INSERT` que impede nascer já como admin.

---

### CRIT-02 — Webhook de pagamento sem verificação de assinatura

**Onde:** `supabase/functions/abacatepay-webhook/index.ts`

A função era um endpoint anônimo que confiava 100% no corpo recebido. Um `curl`
bastava para creditar qualquer conta:

```bash
curl -X POST https://<projeto>.supabase.co/functions/v1/abacatepay-webhook \
  -H 'Content-Type: application/json' \
  -d '{"event":"billing.paid","data":{"id":"x","amount":1,
       "metadata":{"userId":"<uuid-da-vítima-ou-meu>","credits":999999}}}'
```

Três falhas somadas: (a) sem assinatura HMAC, (b) sem idempotência — o mesmo
evento reprocessava a cada reenvio, (c) `credits` vinha do `metadata`, que é
controlado por quem monta a requisição.

**Correção:** HMAC-SHA256 sobre o corpo cru comparado em tempo constante,
deduplicação por `abacate_checkout_id`, créditos derivados do valor pago e
incremento atômico via RPC.

---

### CRIT-03 — Preço definido pelo cliente

**Onde:** `abacatepay-pix/index.ts`, `stellar-payment/index.ts`

Ambas aceitavam `amount` e `credits` do corpo, sem autenticação. O comprador
escolhia o próprio preço: 1 centavo por 1 milhão de créditos. `stellar-payment`
ainda aceitava `userId` livre, permitindo poluir a conta de terceiros.

**Correção:** tabela de preços no servidor (`_shared/pricing.ts`); o cliente
manda apenas `packageId`, e `user_id` vem do JWT.

---

### CRIT-04 — Confirmação de pagamento Stellar só olhava o memo

**Onde:** `supabase/functions/stellar-checker/index.ts`

```js
if (txDetail.memo === payment.stellar_memo) { /* credita */ }
```

Não se verificava **valor**, **ativo** nem **destinatário**. Explorando junto com
CRIT-03: crie um pagamento pendente de 1.000.000 de créditos, envie
**0,0000001 XLM** com o memo correto e receba tudo. Como o endpoint também era
anônimo, o atacante disparava a conferência na hora.

**Correção:** o casamento agora exige `to == PLATFORM_WALLET`,
`asset_type == 'native'`, transação bem-sucedida e **valor ≥ o cobrado**. O
endpoint passou a exigir segredo interno (job de cron), e o N+1 de requisições à
Horizon virou uma chamada com `join=transactions`.

---

### CRIT-05 — `send-signing-email` como open relay de phishing

**Onde:** `supabase/functions/send-signing-email/index.ts`

Endpoint anônimo que aceitava `to`, `signerName` e `contractTitle` livres e os
interpolava **crus** no HTML do e-mail:

```js
<h2>Olá, ${signerName}!</h2>
```

Ou seja: e-mail para qualquer destinatário, **a partir do domínio verificado da
ContractEase**, com HTML arbitrário — `signerName: "<a href='https://evil'>Confirme
seus dados</a>"`. O phishing herda o SPF/DKIM da empresa e a reputação de entrega,
além de queimar o domínio quando denunciado.

**Correção:** exige JWT, valida que o chamador é dono/parte do contrato, busca
destinatário e título **no banco** (nunca do corpo) e escapa todo texto.

---

### CRIT-06 — `anchor-on-stellar` anônima adultera contratos alheios

**Onde:** `supabase/functions/anchor-on-stellar/index.ts`

Sem autenticação, e o `contractId` do corpo era aplicado com `service_role`
(portanto **sem RLS**):

```js
await supabase.from('contracts').update({
  stellar_tx_hash: result.hash, contract_hash: contractHash, status: 'active'
}).eq('id', contractId);
```

Um atacante anônimo podia marcar **qualquer** contrato como `active` e sobrescrever
o `contract_hash` ancorado — exatamente a prova de existência que sustenta o valor
jurídico do produto. Em paralelo, cada chamada gastava XLM da conta custodial:
um laço simples zerava o saldo.

**Correção:** JWT obrigatório, verificação de dono/parte sobre o `contractId`,
validação do formato do hash (SHA-256 hex) e mainnet atrás de flag explícita.

---

### CRIT-07 — `deploy-soroban` anônima drena a conta sponsor

**Onde:** `supabase/functions/deploy-soroban/index.ts`

Mesmo padrão: anônima, com o sponsor (`STELLAR_SECRET_KEY`) pagando as fees de
upload + create + init, e `contractId` arbitrário sobrescrevendo os campos
`soroban_*` de contratos de terceiros. `network: 'mainnet'` era aceito sem
restrição — ou seja, drenagem em **XLM real**.

**Correção:** JWT, verificação de que o chamador é o **dono** do contrato, bloqueio
de redeploy (`409` se já publicado) e mainnet atrás de `ALLOW_MAINNET_DEPLOY`.

---

### CRIT-08 — OTP de 4 dígitos, sem rate limit, para qualquer usuário

**Onde:** `supabase/migrations/20260509044937_create_otp_system.sql`

```sql
v_code := lpad(floor(random() * 10000)::text, 4, '0');
```

Somando os problemas: **4 dígitos** (10.000 combinações), `random()` não
criptográfico, código em texto puro no banco, **sem contador de tentativas** — e,
o mais grave, `verify_otp(p_user_id, ...)` aceitava um `user_id` **arbitrário**,
com `GRANT ... TO authenticated`. Qualquer usuário logado podia atacar a conta de
outro:

```js
for (let i = 0; i < 10000; i++)
  await supabase.rpc('verify_otp', {
    p_user_id: VITIMA, p_code: String(i).padStart(4,'0'), p_purpose: 'login' });
```

Sem lockout, o espaço inteiro é varrido em segundos.

**Correção:** 6 dígitos com `gen_random_bytes` (CSPRNG), hash SHA-256 do código no
banco, máximo de 5 tentativas por código e 3 emissões / 15 min, e o `user_id`
passou a ser derivado de `auth.uid()` — o parâmetro do cliente é rejeitado se
divergir. As assinaturas antigas com `p_email` foram removidas.

---

### CRIT-09 — Chave secreta Stellar em `localStorage` ⚠️ *não corrigido*

**Onde:** `src/services/embeddedWallet.ts:4`

```js
// ⚠️ A secret key é guardada em localStorage SEM criptografia.
window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ secret: kp.secret() }));
```

O risco já está documentado no código, mas precisa ser dimensionado: **qualquer
XSS vira roubo de carteira**. Como HIGH-03 dava XSS e a CSP tinha
`'unsafe-inline'`, a cadeia estava completa — um contrato malicioso enviado para
assinatura levava à exfiltração da chave de quem o abrisse.

Corrigir XSS reduz muito a exposição, mas não elimina: extensões maliciosas e
qualquer XSS futuro continuam alcançando `localStorage`.

**Recomendado (requer decisão de produto):**
1. Derivar chave de criptografia da senha do usuário com PBKDF2/Argon2 e guardar
   apenas o *ciphertext* (AES-GCM via WebCrypto) — já previsto no comentário do arquivo.
2. Manter a chave privada em memória, exigindo desbloqueio por sessão.
3. Melhor ainda: não custodiar. Para mainnet, usar Freighter/carteira externa
   (`@stellar/freighter-api` já é dependência do projeto) e tratar a carteira
   embarcada como recurso exclusivo de testnet, bloqueado por
   `VITE_STELLAR_NETWORK`.

---

## Altas — detalhamento

### HIGH-01 — Dump de PII de toda a base

**Onde:** `20260521101500_backfill_handles_and_secure_profile_directory.sql`

`search_profiles_directory` era `SECURITY DEFINER`, retornava `email` **e**
`wallet_address` de todos os perfis, aceitava busca vazia (`q.k = ''` casava com
tudo) e o `LIMIT` vinha do cliente:

```js
await supabase.rpc('search_profiles_directory', { p_query: '', p_limit: 1000000 });
```

Uma chamada exportava a base inteira de usuários com e-mail e carteira. Além do
risco de spam/phishing direcionado, isso é incidente de dados pessoais sob a LGPD.

**Correção:** removidos `email` e `wallet_address` do retorno, exigido termo com
≥ 3 caracteres, busca por prefixo (não `%termo%`) e `LIMIT` fixado no servidor
(máx. 20).

### HIGH-02 — Estatísticas administrativas abertas

`get_admin_dashboard_stats()` tinha `GRANT ... TO authenticated` e **nenhuma
checagem interna de papel**. Qualquer usuário logado lia faturamento total,
número de usuários e organizações recentes. O `AdminDashboardPage.tsx:20` só
escondia a tela no front — o RPC continuava exposto.
**Correção:** a função agora valida `role IN ('admin','owner')` internamente.

### HIGH-03 — XSS via saída da IA

**Onde:** `src/components/SmartContractEditor.tsx` (3 pontos)

```jsx
dangerouslySetInnerHTML={{ __html: message.text
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') }}
```

Só se tratava negrito e quebra de linha; qualquer `<img src=x onerror=...>` na
resposta era executado. E essa saída **não é confiável**: o prompt inclui o
conteúdo do contrato, que pode ter sido escrito por uma contraparte. Um
signatário conseguia embutir instruções no texto do contrato (*prompt injection*)
para que o modelo devolvesse HTML ativo, executado no navegador de quem abrisse o
documento — e daí para a chave da carteira (CRIT-09).

**Correção:** `src/utils/safeHtml.ts` — escapa tudo primeiro e só então
reintroduz `<strong>` e `<br>`, com a classe CSS vinda do nosso código.

### HIGH-05 / HIGH-06 — Clickjacking e CSP fraca

A CSP existia apenas como `<meta http-equiv>`, e **`<meta>` ignora
`frame-ancestors`**. Sem `X-Frame-Options` no servidor, qualquer site podia
embutir o ContractEase num iframe transparente e induzir o usuário a clicar em
"Assinar" achando que clicava em outra coisa. Para uma plataforma de assinatura,
isso é falha de integridade do ato jurídico, não só de interface.

A CSP também trazia `'unsafe-inline'` em `script-src`, o que praticamente anula a
proteção contra XSS refletido.

**Correção:** cabeçalhos HTTP reais em `vercel.json` e `nginx.conf`, com
`frame-ancestors 'none'`, `X-Frame-Options: DENY`, `script-src` sem
`'unsafe-inline'`, além de HSTS, `Referrer-Policy`, `Permissions-Policy`,
`object-src 'none'`, `base-uri` e `form-action`. O `<meta>` continua como
fallback permissivo para o dev server — como o navegador aplica **todas** as
políticas presentes, a mais restritiva prevalece em produção.

### HIGH-07 — Verificação do signatário só no cliente ⚠️ *não corrigido*

**Onde:** `src/pages/PublicSignPage.tsx`

O fluxo exibe etapas de identificação (`identify → verify → cpf → otp → sign`),
mas a assinatura é persistida por um `UPDATE` direto do cliente:

```js
await supabase.from('contract_parties').update({ signed_at, signature_image, ... })
  .eq('id', partyId);
```

As etapas de OTP/CPF são apenas estado do React: quem chamar o `update`
diretamente assina **sem passar por nenhuma delas**. O RLS
(`party_can_sign_own_row`) só garante que o e-mail da linha bate com o e-mail
autenticado — nada verifica que o OTP foi validado.

Agrava: a página chama `supabase.functions.invoke('signing-otp', ...)`, mas **não
existe função `signing-otp` no repositório** — a etapa provavelmente falha ou é
ignorada em produção.

**Recomendado:** mover a assinatura para uma Edge Function que (a) valide o OTP no
servidor, (b) grave `signed_at` com relógio do servidor, (c) registre IP e
user-agent para trilha de auditoria, e revogar o `UPDATE` direto do cliente sobre
as colunas de assinatura. O trigger de MED-01 já impede retrodatação, mas a
verificação de identidade continua pendente de implementação server-side.

---

## Web3 — auditoria dos smart contracts

### W3-01 — Reentrância: violação de Checks-Effects-Interactions ✅

**Padrão encontrado em 13 funções de 5 contratos.** Todas transferiam tokens
**antes** de gravar o estado que impede a repetição da operação. Exemplo mais
direto (`real-estate-vault::claim_rent`):

```rust
if env.storage().persistent().has(&claim_key) { panic!(AlreadyClaimed) }
verify_merkle(...);
token_transfer(&env, &v.payout_asset, ..., &holder, amount);   // ← interação
env.storage().persistent().set(&claim_key, &true);             // ← efeito, tarde demais
```

`payout_asset` é um endereço de contrato definido no `init`. Durante o
`transfer`, esse contrato pode reentrar em `claim_rent`: `claim_key` ainda não
existe, a checagem passa, a mesma prova Merkle é aceita de novo — e o laço se
repete até drenar o vault.

Funções corrigidas:

| Contrato | Funções |
|---|---|
| `real-estate-vault` | `claim_rent`, `claim_sale_proceeds` |
| `freelancer` | `finalize_approval` (usada por `approve_delivery` e `auto_approve`) |
| `rent` | `terminate_for_default`, `release_deposit`, `retain_deposit` |
| `ecommerce` | `confirm_delivery`, `auto_release`, `refund`, `partial_refund`, `arbitrate`, `claim_after_dispute_timeout` |
| `construction` | `client_release`, `release_retention`, `settle_warranty`, `arbitrate_warranty` |

Em todas, o estado passou a ser gravado antes da transferência.

> **Nota de risco:** contratos SEP-41 comuns não reentram. O vetor se concretiza
> quando o `asset`/`payout_asset` é escolhido por uma das partes — que é
> exatamente o caso: o endereço vem dos `initArgs` montados no frontend. Um
> "token" malicioso passado no init transforma cada uma dessas funções em
> drenagem do escrow.

### W3-02 — `create` e `init` não são atômicos ⚠️ *não corrigido*

**Onde:** `supabase/functions/deploy-soroban/index.ts`

O deploy usa três transações separadas: upload do WASM, `createCustomContract` e,
por fim, `contract.call('init', ...)`. Entre a segunda e a terceira, o contrato
existe **inicializado por ninguém** — e `init` não tem `require_auth`. Um
observador da rede pode chamar `init` primeiro, com os próprios endereços como
`landlord`/`client`/`sponsor`, sequestrando o contrato antes do dono legítimo.
A janela é de alguns segundos (o código faz polling de 2 s por transação), mas é
determinística e observável na ledger.

**Recomendado:** usar o construtor nativo do Soroban
(`createCustomContract` com `constructorArgs`, protocolo 22+), que cria e
inicializa numa única transação. Alternativa, se for preciso manter as etapas
separadas: exigir no `init` a assinatura do deployer esperado, gravado como
argumento do `salt`.

### W3-03 — `rent::init` sem validar parâmetros ✅

Três problemas: `deposit_months == 0` gerava caução zero, e `pay_deposit` então
abortava em `token_transfer` (que rejeita `amount <= 0`), **travando o contrato em
`AwaitingDeposit` para sempre**; `late_fee_bps` não tinha teto, e a multa cresce
com os dias de atraso sem limite; `max_consecutive_overdue == 0` tornava
`terminate_for_default` inalcançável, prendendo a caução.
**Correção:** validações adicionadas no `init`.

### W3-04 / W3-05 / W3-06 — Riscos de desenho ⚠️ *documentados*

- **`buy_shares` sem escrow:** o investidor paga **direto para o sponsor**
  (`token_transfer(..., &buyer, &v.sponsor, cost)`), não para o contrato. Se a
  captação não fechar, não há mecanismo de reembolso on-chain — o dinheiro já saiu.
  Considerar reter no contrato até `close_fundraising`.
- **Centralização:** `release_deposit`/`retain_deposit` (rent) e
  `distribute_rent`/`execute_sale` (vault) são decisões unilaterais do
  locador/sponsor sobre fundos de terceiros. Sem árbitro obrigatório ou janela de
  contestação, a garantia "on-chain" é menor do que aparenta.
- **Sem pausa nem upgrade:** nenhum contrato tem `pause()` ou caminho de migração.
  Descoberto um bug com fundos travados, não há remediação possível. Avaliar um
  guardião com poder apenas de pausar (nunca de mover fundos).

---

## Limitações do que foi feito

Para calibrar a confiança nos resultados:

- **Foi feita revisão de código, não teste dinâmico.** Não havia instância
  publicada nem credenciais disponíveis nesta sessão, então nenhum dos exploits
  descritos foi executado contra um ambiente real. Os payloads acima derivam da
  leitura do código e devem ser confirmados em homologação.
- **Verificação das correções:** `npm run typecheck` e `npm run build` passam
  limpos; `cargo check --all` compila os 7 contratos sem erros.
- **`cargo test --all` não roda neste ambiente** — falha ao compilar
  `soroban-env-host` por um conflito de versões entre `ed25519-dalek` e
  `rand_chacha` (`ChaCha20Rng: CryptoRng` não satisfeito). **Esse erro é
  pré-existente**: confirmei que ocorre de forma idêntica na árvore sem minhas
  alterações. Ou seja, as mudanças de reordenação CEI **não foram validadas por
  testes** — recomendo rodar a suíte assim que a dependência for destravada
  (provavelmente atualizando `soroban-sdk`).
- **Não auditado:** dependências de terceiros (`npm audit` / `cargo audit` não
  executados), configuração do projeto Supabase fora das migrations (políticas do
  painel, buckets criados manualmente, configuração de Auth), e a segurança
  operacional do provedor de e-mail e da AbacatePay.

---

## Ações necessárias antes do deploy

As correções de código não bastam — estes passos são obrigatórios:

1. **Rotacionar todos os segredos.** `STELLAR_SECRET_KEY`, `GEMINI_API_KEY`,
   `RESEND_API_KEY`, `ABACATEPAY_API_KEY` e o `SERVICE_ROLE_KEY` estiveram
   expostos a abuso por endpoints anônimos. Trate-os como comprometidos.
2. **Configurar os novos secrets** nas Edge Functions:
   - `ALLOWED_ORIGINS` — origens do app, separadas por vírgula (fecha o CORS).
   - `ABACATEPAY_WEBHOOK_SECRET` — segredo HMAC, obtido no painel da AbacatePay.
   - `STELLAR_CHECKER_SECRET` — segredo do job de conferência (header `x-internal-secret`).
   - `ALLOW_MAINNET_ANCHOR` / `ALLOW_MAINNET_DEPLOY` — só `true` quando for a intenção.
3. **Aplicar as migrations** `20260805120000` e `20260805120100`.
4. **Auditar os dados existentes** — os furos estiveram abertos:
   ```sql
   SELECT id, email, role, credits, plan FROM public.profiles
   WHERE role <> 'user' OR credits > 1000;

   SELECT * FROM public.payments WHERE status = 'completed'
     AND abacate_checkout_id IS NULL;   -- créditos sem checkout correspondente
   ```
5. **Atualizar o frontend** para o novo contrato das funções de pagamento: enviar
   `{ packageId }` em vez de `{ amount, credits }` (ver `_shared/pricing.ts`).
6. **Agendar `stellar-checker`** como cron enviando o header `x-internal-secret`
   (a função não é mais pública).
7. **Redeployar os contratos Soroban** — as correções de reentrância só valem para
   instâncias novas; contratos já publicados mantêm o bytecode vulnerável.

---

## Pendências (não corrigidas neste branch)

| ID | Pendência | Por que não foi corrigida aqui |
|----|-----------|-------------------------------|
| CRIT-09 | Criptografar a carteira embarcada | Exige decisão de produto (senha vs. carteira externa) e fluxo de recuperação |
| HIGH-07 | Verificação de assinatura no servidor | Requer criar a Edge Function `signing-otp`, que não existe no repositório |
| W3-02 | Deploy atômico (create + init) | Depende de migrar para construtor nativo do Soroban (protocolo 22+) |
| W3-04/05/06 | Escrow em `buy_shares`, descentralização, pausa | Mudanças de modelo de negócio, não de implementação |
| MED-10 | SRI nos scripts do iconify | Requer os hashes dos assets; ideal é servir localmente via npm |
| LOW-01 | `/seed` em produção | Confirmar se a rota deve ser removida ou gated por `import.meta.env.DEV` |
| LOW-02 | `src/services/httpClient.ts` | Código morto (mock); recomenda-se apagar para não virar referência |
