-- Document Authentications
-- Hash SHA-256 gerado no browser → documento salvo no Storage → hash ancorado na Stellar.

CREATE TABLE public.document_authentications (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_name       text        NOT NULL,
  document_size       integer     NOT NULL,
  document_mime_type  text,
  sha256_hash         text        NOT NULL,
  storage_path        text,
  stellar_tx_hash     text,
  stellar_ledger      integer,
  stellar_network     text        NOT NULL DEFAULT 'testnet',
  anchored_at         timestamptz,
  status              text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'anchored', 'error')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_authentications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_document_authentications"
  ON public.document_authentications
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_doc_auth_user_id ON public.document_authentications (user_id, created_at DESC);
CREATE INDEX idx_doc_auth_hash    ON public.document_authentications (sha256_hash);

-- Storage bucket (privado, 50 MB por arquivo)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-authentications',
  'document-authentications',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg','image/png','image/webp','image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv'
  ]
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users_own_document_storage"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'document-authentications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'document-authentications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
