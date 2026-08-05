-- ═══════════════════════════════════════════════════════════════════════
-- [CE-12] Anexos de contrato deixam de ser servidos por URL pública
--
-- `ContractDetailPage.tsx` montava o link de download com `getPublicUrl()`.
-- Esse método não valida nada: apenas concatena
--   /storage/v1/object/public/<bucket>/<path>
-- Se o bucket estiver marcado como público, essa rota **não passa pelo RLS de
-- storage.objects** — as policies "Owners can read attachments" simplesmente
-- não se aplicam. O resultado seria acesso anônimo a anexos de contrato
-- (documentos com dados pessoais), bastando conhecer/adivinhar o caminho.
--
-- O flag `public` do bucket é configuração do projeto, não do repositório, então
-- não dava para saber pelo código se estava aberto. Esta migration remove a
-- dúvida: força o bucket a privado de forma idempotente. O frontend passou a
-- usar signed URLs de curta duração (ver ContractDetailPage.tsx).
-- ═══════════════════════════════════════════════════════════════════════

-- Cria o bucket caso ainda não exista (ele nunca foi criado por migration —
-- só pelo painel — o que também explica a incerteza sobre o flag).
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- E garante privacidade mesmo se já existia marcado como público.
UPDATE storage.buckets SET public = false WHERE id = 'attachments';

-- O bucket `contracts` guarda os PDFs dos contratos: mesmo tratamento.
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets SET public = false WHERE id = 'contracts';

-- Reafirma as policies de leitura por dono (o primeiro segmento do path é o
-- uid de quem enviou). Com o bucket privado, é isto que passa a valer de fato.
DROP POLICY IF EXISTS "Owners can read attachments" ON storage.objects;
CREATE POLICY "Owners can read attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Owners can delete attachments" ON storage.objects;
CREATE POLICY "Owners can delete attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- NOTA para o time: os buckets `avatars` e `brand-kits` também são lidos via
-- getPublicUrl() no código (supabaseService.ts:244 e :819), enquanto a policy de
-- `avatars` diz "Authenticated users can read avatars" — sinais contraditórios
-- sobre a intenção. Não alteramos esses dois aqui para não quebrar a exibição de
-- avatares e logos, mas a divergência precisa de decisão explícita.
