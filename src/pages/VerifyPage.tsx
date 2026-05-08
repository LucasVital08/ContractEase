import { useState } from 'react';
import { motion } from 'motion/react';
import { useContracts } from '@/hooks/useContractQueries';
import { useStellar } from '@/hooks/useStellar';

export default function VerifyPage() {
  const [search, setSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const { data: contracts = [], isLoading } = useContracts();
  const { verifyTransaction, isVerifying } = useStellar();

  const [blockchainData, setBlockchainData] = useState<{
    verified: boolean;
    ledger?: number;
    timestamp?: string;
  } | null>(null);

  const foundContract = contracts.find(
    c => c.contractHash === search || c.stellarTxHash === search || c.id === search
  );

  const handleVerify = async () => {
    if (!search.trim()) return;
    setHasSearched(true);
    setBlockchainData(null);

    // If a contract is found and has a Stellar tx hash, verify it on-chain
    const matched = contracts.find(
      c => c.contractHash === search || c.stellarTxHash === search || c.id === search
    );
    if (matched?.stellarTxHash) {
      const result = await verifyTransaction(matched.stellarTxHash);
      setBlockchainData(result);
    }
  };

  return (
    <div className="flex flex-col px-4">
      <div className="max-w-3xl mx-auto w-full text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-6 border border-emerald-500/20">
          <iconify-icon icon="solar:shield-check-bold-duotone" class="text-3xl text-emerald-500" />
        </div>
        <h1 className="text-4xl font-bold text-white font-bricolage mb-4">Verificador de Autenticidade</h1>
        <p className="text-neutral-400 text-lg">
          Valide a integridade de qualquer contrato ancorado na blockchain Stellar usando o Hash do Documento, Transaction Hash ou ID Único.
        </p>

        <div className="mt-8 flex gap-3 max-w-xl mx-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setHasSearched(false); setBlockchainData(null); }}
            placeholder="Cole o Hash SHA-256 ou Transaction Hash aqui..."
            className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          />
          <button 
            onClick={handleVerify}
            disabled={isVerifying}
            className="bg-emerald-500 text-black px-6 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isVerifying && <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
            Verificar
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full pb-20">
        {(isLoading || isVerifying) && hasSearched && (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          </div>
        )}

        {!isLoading && !isVerifying && hasSearched && !foundContract && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
            <iconify-icon icon="solar:close-circle-bold" class="text-4xl text-red-400 mb-2" />
            <h3 className="text-lg font-bold text-white mb-1">Registro Não Encontrado</h3>
            <p className="text-sm text-neutral-400">Não localizamos nenhum contrato que corresponda a este Hash. Verifique a integridade da informação.</p>
          </motion.div>
        )}

        {!isLoading && !isVerifying && hasSearched && foundContract && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-neutral-900 border border-emerald-500/30 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-emerald-500/20 p-2 rounded-full flex">
                <iconify-icon icon="solar:shield-check-bold" class="text-2xl text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-emerald-400">Documento Válido e Autêntico</h3>
                <p className="text-xs text-neutral-400">Em conformidade com MP 2.200-2 e LGPD</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-500 uppercase">Título do Contrato</p>
                  <p className="text-sm text-white font-semibold mt-1">{foundContract.title}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 uppercase">Status Global</p>
                  <p className="text-sm text-white font-semibold mt-1 capitalize">{foundContract.status}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 uppercase">Assinaturas</p>
                  <p className="text-sm text-white font-semibold mt-1">
                    {foundContract.parties.filter(p => p.signedAt).length}/{foundContract.parties.length} completas
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 uppercase">Criado em</p>
                  <p className="text-sm text-white font-semibold mt-1">
                    {new Date(foundContract.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {/* Blockchain Verification */}
              {blockchainData && (
                <div className={`rounded-xl p-4 border ${blockchainData.verified ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <iconify-icon 
                      icon={blockchainData.verified ? "solar:verified-check-bold" : "solar:danger-circle-bold"} 
                      class={`text-xl ${blockchainData.verified ? 'text-emerald-400' : 'text-red-400'}`} 
                    />
                    <p className={`text-sm font-bold ${blockchainData.verified ? 'text-emerald-400' : 'text-red-400'}`}>
                      {blockchainData.verified ? 'Verificado na Stellar Blockchain' : 'Transação não encontrada na blockchain'}
                    </p>
                  </div>
                  {blockchainData.verified && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-neutral-500 uppercase">Ledger</p>
                        <p className="text-xs text-white font-mono">{blockchainData.ledger || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-500 uppercase">Timestamp (Blockchain)</p>
                        <p className="text-xs text-white font-mono">
                          {blockchainData.timestamp ? new Date(blockchainData.timestamp).toLocaleString('pt-BR') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-black/50 border border-white/5 rounded-xl p-4 space-y-4">
                <div>
                  <p className="text-[10px] text-neutral-500 uppercase mb-1">Hash Original (SHA-256)</p>
                  <p className="text-xs text-emerald-400 font-mono break-all">{foundContract.contractHash || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-500 uppercase mb-1">Transaction Hash (Blockchain)</p>
                  {foundContract.stellarTxHash ? (
                    <a href={`https://stellar.expert/explorer/testnet/tx/${foundContract.stellarTxHash}`} target="_blank" className="text-xs text-emerald-400 font-mono break-all hover:underline">{foundContract.stellarTxHash}</a>
                  ) : (
                    <p className="text-xs text-neutral-500 font-mono">Não registrado</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white mb-3">Signatários Validados</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {foundContract.parties.map(party => (
                    <div key={party.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <p className="text-sm font-medium text-white">{party.name}</p>
                          <p className="text-[10px] text-neutral-400">CPF: {party.cpf ? '***.' + party.cpf.replace(/\D/g, '').slice(3, 6) + '.***-**' : 'N/A'}</p>
                        </div>
                        <iconify-icon icon={party.signedAt ? "solar:check-circle-bold" : "solar:clock-circle-bold"} class={party.signedAt ? "text-emerald-400" : "text-amber-400"} />
                      </div>
                      {party.signedAt && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                          <div>
                            <p className="text-[10px] text-neutral-500">Assinado em</p>
                            <p className="text-[10px] text-white font-mono">{new Date(party.signedAt).toLocaleString('pt-BR')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-500">IP</p>
                            <p className="text-[10px] text-white font-mono">{party.ipAddress || 'N/A'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
