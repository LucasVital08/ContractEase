import { supabase } from '@/lib/supabase';

export interface DocumentAuth {
  id: string;
  userId: string;
  documentName: string;
  documentSize: number;
  documentMimeType: string | null;
  sha256Hash: string;
  storagePath: string | null;
  stellarTxHash: string | null;
  stellarLedger: number | null;
  stellarNetwork: string;
  anchoredAt: string | null;
  status: 'pending' | 'anchored' | 'error';
  createdAt: string;
}

export interface VerifyResult {
  match: boolean;
  computedHash: string;
  storedHash: string;
  record: DocumentAuth | null;
}

// ─── Hash SHA-256 no browser (Web Crypto API, nada sai do dispositivo) ────────

export async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Autenticar documento ────────────────────────────────────────────────────

export async function authenticateDocument(
  file: File,
  userId: string,
): Promise<DocumentAuth> {
  // 1. Hash no browser
  const sha256Hash = await computeSha256(file);

  // 2. Upload para Supabase Storage (pasta do usuário)
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
  const storagePath = `${userId}/${timestamp}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('document-authentications')
    .upload(storagePath, file, { upsert: false, contentType: file.type });

  if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`);

  // 3. Inserir registro inicial (status pending)
  const { data: record, error: insertError } = await supabase
    .from('document_authentications')
    .insert({
      user_id: userId,
      document_name: file.name,
      document_size: file.size,
      document_mime_type: file.type || null,
      sha256_hash: sha256Hash,
      storage_path: storagePath,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError || !record) {
    throw new Error(`Registro falhou: ${insertError?.message}`);
  }

  const docAuth = mapRow(record);

  // 4. Ancorar hash na Stellar via Edge Function
  try {
    const { data: anchorData, error: fnError } = await supabase.functions.invoke(
      'anchor-document',
      { body: { documentHash: sha256Hash, recordId: docAuth.id, network: 'testnet' } },
    );

    if (fnError) throw fnError;

    return {
      ...docAuth,
      stellarTxHash: anchorData.stellarTxHash,
      stellarLedger: anchorData.stellarLedger ?? null,
      stellarNetwork: anchorData.network,
      anchoredAt: new Date().toISOString(),
      status: 'anchored',
    };
  } catch {
    // Não falha o fluxo — registro já está salvo, ancoragem pode ser refeita
    await supabase
      .from('document_authentications')
      .update({ status: 'error' })
      .eq('id', docAuth.id);

    return { ...docAuth, status: 'error' };
  }
}

// ─── Verificar integridade ───────────────────────────────────────────────────

export async function verifyDocument(
  file: File,
  recordIdOrHash?: string,
): Promise<VerifyResult> {
  const computedHash = await computeSha256(file);

  let record: DocumentAuth | null = null;

  if (recordIdOrHash) {
    // Busca por ID ou por hash diretamente
    const isUuid = /^[0-9a-f-]{36}$/i.test(recordIdOrHash);
    const { data } = isUuid
      ? await supabase
          .from('document_authentications')
          .select('*')
          .eq('id', recordIdOrHash)
          .single()
      : await supabase
          .from('document_authentications')
          .select('*')
          .eq('sha256_hash', recordIdOrHash)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

    if (data) record = mapRow(data);
  } else {
    // Tenta encontrar o documento pelo hash computado
    const { data } = await supabase
      .from('document_authentications')
      .select('*')
      .eq('sha256_hash', computedHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) record = mapRow(data);
  }

  const storedHash = record?.sha256Hash ?? '';
  return {
    match: storedHash.length > 0 && computedHash === storedHash,
    computedHash,
    storedHash,
    record,
  };
}

// ─── Listar documentos do usuário ────────────────────────────────────────────

export async function listDocumentAuthentications(): Promise<DocumentAuth[]> {
  const { data, error } = await supabase
    .from('document_authentications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

// ─── Baixar URL temporária do arquivo ────────────────────────────────────────

export async function getDocumentDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('document-authentications')
    .createSignedUrl(storagePath, 300); // expira em 5 min

  if (error || !data) throw new Error('Não foi possível gerar o link');
  return data.signedUrl;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): DocumentAuth {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    documentName: row.document_name as string,
    documentSize: row.document_size as number,
    documentMimeType: (row.document_mime_type as string) ?? null,
    sha256Hash: row.sha256_hash as string,
    storagePath: (row.storage_path as string) ?? null,
    stellarTxHash: (row.stellar_tx_hash as string) ?? null,
    stellarLedger: (row.stellar_ledger as number) ?? null,
    stellarNetwork: (row.stellar_network as string) ?? 'testnet',
    anchoredAt: (row.anchored_at as string) ?? null,
    status: row.status as DocumentAuth['status'],
    createdAt: row.created_at as string,
  };
}

export function getStellarExplorerUrl(txHash: string, network: string): string {
  const net = network === 'mainnet' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${net}/tx/${txHash}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function truncateHash(hash: string, chars = 16): string {
  return `${hash.slice(0, chars)}…${hash.slice(-8)}`;
}
