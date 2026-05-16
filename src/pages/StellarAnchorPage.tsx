import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores';
import { anchorOnStellar, generateContractHash, getStellarExplorerUrl } from '@/services/stellar';

interface AnchorLog {
  title: string;
  status: 'pending' | 'hashing' | 'submitting' | 'done' | 'error';
  txHash?: string;
  contractHash?: string;
  error?: string;
}

export default function StellarAnchorPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [logs, setLogs] = useState<AnchorLog[]>([]);
  const [done, setDone] = useState(false);
  const [running, setRunning] = useState(false);

  const updateLog = (index: number, update: Partial<AnchorLog>) =>
    setLogs(prev => prev.map((l, i) => i === index ? { ...l, ...update } : l));

  useEffect(() => {
    if (!user || running) return;
    setRunning(true);
    run();
  }, [user]);

  async function run() {
    // 1. Buscar contratos que deveriam ter ancoragem (status completed ou active)
    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('id, title, description, status')
      .eq('owner_id', user!.id)
      .in('status', ['completed', 'active', 'pending'])
      .order('created_at', { ascending: true });

    if (error || !contracts?.length) {
      setLogs([{ title: 'Erro ao buscar contratos', status: 'error', error: error?.message || 'Nenhum contrato encontrado' }]);
      setDone(true);
      return;
    }

    // Inicializar logs
    setLogs(contracts.map(c => ({ title: c.title, status: 'pending' })));

    let successCount = 0;

    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i];
      updateLog(i, { status: 'hashing' });

      try {
        // 2. Buscar cláusulas e partes para gerar hash real
        const [{ data: clauses }, { data: parties }] = await Promise.all([
          supabase.from('contract_clauses').select('title, content, order_index').eq('contract_id', contract.id).order('order_index'),
          supabase.from('contract_parties').select('name, email').eq('contract_id', contract.id),
        ]);

        // 3. Serializar conteúdo determinístico e gerar SHA-256
        const serialized = JSON.stringify({
          title: contract.title,
          description: contract.description,
          clauses: (clauses || []).sort((a, b) => a.order_index - b.order_index).map(c => ({ title: c.title, content: c.content })),
          parties: (parties || []).sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ name: p.name, email: p.email })),
        });

        const contractHash = await generateContractHash(serialized);
        updateLog(i, { status: 'submitting', contractHash });

        // 4. Submeter transação real na Stellar testnet
        const result = await anchorOnStellar(contractHash);

        if (!result.success || !result.txHash) {
          throw new Error(result.error || 'Falha na ancoragem');
        }

        // 5. Atualizar contrato no Supabase com hash real
        await supabase
          .from('contracts')
          .update({
            stellar_tx_hash: result.txHash,
            contract_hash: contractHash,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contract.id);

        updateLog(i, { status: 'done', txHash: result.txHash });
        successCount++;

      } catch (err: any) {
        updateLog(i, { status: 'error', error: err.message });
      }

      // Pequena pausa para não sobrecarregar o Horizon
      await new Promise(r => setTimeout(r, 800));
    }

    setDone(true);

    // Redirecionar para dashboard após 4s
    setTimeout(() => navigate('/contracts'), 4000);
  }

  const statusIcon = (s: AnchorLog['status']) => {
    if (s === 'pending')    return <span className="text-neutral-500">○</span>;
    if (s === 'hashing')    return <span className="text-yellow-400 animate-pulse">◑</span>;
    if (s === 'submitting') return <span className="text-blue-400 animate-pulse">◐</span>;
    if (s === 'done')       return <span className="text-emerald-400">✔</span>;
    if (s === 'error')      return <span className="text-red-400">✖</span>;
  };

  const statusLabel = (s: AnchorLog['status']) => {
    if (s === 'pending')    return 'Aguardando...';
    if (s === 'hashing')    return 'Gerando hash SHA-256...';
    if (s === 'submitting') return 'Submetendo à Stellar testnet...';
    if (s === 'done')       return 'Ancorado ✔';
    if (s === 'error')      return 'Erro';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-mono">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center font-bold text-lg">⭐</div>
          <div>
            <h1 className="text-xl font-bold font-sans">Ancoragem Real — Stellar Testnet</h1>
            <p className="text-neutral-500 text-sm">Gerando hashes SHA-256 e submetendo transações reais</p>
          </div>
        </div>

        <div className="text-xs text-neutral-600 mb-6">
          Conta demo: <span className="text-neutral-400">GBV3G7EPMWJLLWAQWAIUO4JNUF737WYGG5GAHTLQBNPJHBNG26264SD7</span>
        </div>

        {/* Logs */}
        <div className="bg-neutral-900 border border-white/10 rounded-xl p-6 space-y-4">
          {logs.length === 0 && (
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
              <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              Buscando contratos...
            </div>
          )}

          {logs.map((log, i) => (
            <div key={i} className="border border-white/5 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{statusIcon(log.status)}</span>
                <span className={`text-sm font-medium ${log.status === 'done' ? 'text-white' : log.status === 'error' ? 'text-red-400' : 'text-neutral-300'}`}>
                  {log.title.length > 60 ? log.title.substring(0, 60) + '...' : log.title}
                </span>
              </div>

              <div className="text-xs text-neutral-500 pl-6">{statusLabel(log.status)}</div>

              {log.contractHash && (
                <div className="pl-6 text-xs text-neutral-600">
                  SHA-256: <span className="text-neutral-400 break-all">{log.contractHash}</span>
                </div>
              )}

              {log.status === 'done' && log.txHash && (
                <div className="pl-6 space-y-1">
                  <div className="text-xs text-neutral-600">
                    TX Hash: <span className="text-emerald-400 break-all">{log.txHash}</span>
                  </div>
                  <a
                    href={getStellarExplorerUrl(log.txHash, 'testnet')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Ver no stellar.expert →
                  </a>
                </div>
              )}

              {log.status === 'error' && (
                <div className="pl-6 text-xs text-red-400">{log.error}</div>
              )}
            </div>
          ))}
        </div>

        {done && (
          <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm text-center font-sans">
            ✔ Ancoragem concluída! Redirecionando para contratos em 4s...
          </div>
        )}
      </div>
    </div>
  );
}
