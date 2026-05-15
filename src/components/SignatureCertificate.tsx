import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { Contract } from '@/types';
import { generateContractHash, serializeContract } from '@/services/stellar';

const SIG_TYPE_LABEL: Record<string, string> = {
  type: 'Eletrônica (Aceite Digital)',
  draw: 'Manuscrita (Desenho)',
  upload: 'Imagem Carregada',
  a1: 'Certificado A1 (ICP-Brasil)',
  freighter: 'Carteira Stellar (Freighter)',
};

interface SignatureCertificateProps {
  contract: Contract;
  onClose: () => void;
}

export default function SignatureCertificate({ contract, onClose }: SignatureCertificateProps) {
  const signedParties = contract.parties.filter(p => p.signedAt);
  const allSigned = contract.parties.every(p => p.signedAt);
  const [liveHash, setLiveHash] = useState(contract.contractHash || '');

  useEffect(() => {
    if (contract.contractHash) { setLiveHash(contract.contractHash); return; }
    generateContractHash(
      serializeContract({
        title: contract.title,
        description: contract.description,
        clauses: contract.clauses.map(c => ({ title: c.title, content: c.content, order: c.order })),
        parties: contract.parties.map(p => ({ name: p.name, email: p.email })),
      })
    ).then(setLiveHash);
  }, [contract]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 p-8 text-white text-center rounded-t-2xl relative">
          <div className="absolute top-4 right-4">
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <iconify-icon icon="solar:close-circle-bold" class="text-xl" />
            </button>
          </div>
          <iconify-icon icon="solar:shield-check-bold-duotone" class="text-5xl mb-3" />
          <h2 className="text-2xl font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Certificado de Assinatura Digital</h2>
          <p className="text-emerald-100 text-sm mt-1">Documento eletrônico válido conforme MP 2.200-2/2001</p>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6 text-black">
          {/* Contract Info */}
          <div className="border border-neutral-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wide mb-3">Informações do Documento</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-neutral-400 text-xs">Título</p>
                <p className="font-semibold">{contract.title}</p>
              </div>
              <div>
                <p className="text-neutral-400 text-xs">ID</p>
                <p className="font-mono text-xs">{contract.id}</p>
              </div>
              <div>
                <p className="text-neutral-400 text-xs">Criado em</p>
                <p>{new Date(contract.createdAt).toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-neutral-400 text-xs">Status</p>
                <p className={allSigned ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                  {allSigned ? 'Todas as partes assinaram' : `${signedParties.length}/${contract.parties.length} assinaturas`}
                </p>
              </div>
            </div>
          </div>

          {/* Hash Info */}
          <div className="border border-neutral-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wide mb-3">Integridade Criptográfica</h3>
            <div>
              <p className="text-neutral-400 text-xs mb-1">Hash SHA-256 do Contrato</p>
              <p className="font-mono text-[11px] bg-neutral-100 p-3 rounded-lg break-all leading-relaxed text-neutral-700">
                {liveHash || 'Calculando...'}
              </p>
            </div>
          </div>

          {/* Blockchain Audit — bloco destacado */}
          {contract.stellarTxHash ? (
            <div className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-cyan-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <iconify-icon icon="solar:shield-check-bold-duotone" class="text-2xl text-emerald-600" />
                  <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wide">Registro Blockchain</h3>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  Stellar Testnet
                </span>
              </div>

              <p className="text-xs text-emerald-800 mb-4 leading-relaxed">
                Este documento foi ancorado de forma imutável na blockchain Stellar Network. A transação abaixo é prova pública de existência e integridade — verificável por qualquer pessoa, a qualquer momento.
              </p>

              <div className="bg-white border border-emerald-200 rounded-xl p-3 mb-3">
                <p className="text-[10px] text-neutral-400 uppercase tracking-wide mb-1.5">Hash da Transação (TX ID)</p>
                <p className="font-mono text-[11px] text-neutral-700 break-all leading-relaxed">{contract.stellarTxHash}</p>
              </div>

              <a
                href={`https://stellar.expert/explorer/testnet/tx/${contract.stellarTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold rounded-xl transition-colors"
              >
                <iconify-icon icon="solar:globus-bold" class="text-base" />
                Auditar Transação na Stellar Explorer
                <iconify-icon icon="solar:arrow-right-up-bold" class="text-sm" />
              </a>

              <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-emerald-700/60">
                <span className="flex items-center gap-1"><iconify-icon icon="solar:lock-bold" /> Imutável</span>
                <span className="flex items-center gap-1"><iconify-icon icon="solar:clock-bold" /> Carimbo de Tempo</span>
                <span className="flex items-center gap-1"><iconify-icon icon="solar:eye-bold" /> Público e Auditável</span>
              </div>
            </div>
          ) : (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex items-start gap-3">
              <iconify-icon icon="solar:danger-triangle-bold" class="text-amber-500 text-lg flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-700">Ancoragem Blockchain Pendente</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Este documento ainda não foi registrado na blockchain. Acesse o contrato e clique em "Ancorar" para garantir a rastreabilidade.
                </p>
              </div>
            </div>
          )}

          {/* Signatories */}
          <div className="border border-neutral-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wide mb-3">Signatários</h3>
            <div className="space-y-4">
              {contract.parties.map(party => (
                <div key={party.id} className={`p-4 rounded-xl border ${party.signedAt ? 'bg-emerald-50 border-emerald-200' : 'bg-neutral-50 border-neutral-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${party.signedAt ? 'bg-emerald-500' : 'bg-neutral-400'}`}>
                        {party.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{party.name}</p>
                        <p className="text-xs text-neutral-400">{party.email} · {party.role}</p>
                      </div>
                    </div>
                    {party.signedAt ? (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <iconify-icon icon="solar:check-circle-bold" /> Assinado
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-500">Pendente</span>
                    )}
                  </div>

                  {party.signedAt && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-emerald-200/50">
                      <div>
                        <p className="text-[10px] text-neutral-400 uppercase">Data/Hora</p>
                        <p className="text-xs font-mono">{new Date(party.signedAt).toLocaleString('pt-BR')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 uppercase">CPF</p>
                        <p className="text-xs">{party.cpf ? `***.*${party.cpf.slice(4, 7)}*.***-**` : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 uppercase">IP</p>
                        <p className="text-xs font-mono">{party.ipAddress || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 uppercase">Geolocalização</p>
                        <p className="text-xs font-mono truncate" title={party.geolocation}>{party.geolocation || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 uppercase">Tipo</p>
                        <p className="text-xs">{party.signatureType ? (SIG_TYPE_LABEL[party.signatureType] ?? party.signatureType) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 uppercase">LGPD</p>
                        <p className={`text-xs font-bold ${party.lgpdConsent ? 'text-emerald-600' : 'text-red-500'}`}>
                          {party.lgpdConsent ? '✓ Consentido' : '✗ Pendente'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Legal */}
          <div className="text-center py-4 border-t border-neutral-200 text-xs text-neutral-400 space-y-1">
            <p>Este certificado atesta a autenticidade das assinaturas eletrônicas apostas neste documento,</p>
            <p>em conformidade com a Medida Provisória nº 2.200-2/2001 (ICP-Brasil) e com a Lei Geral de Proteção de Dados (LGPD).</p>
            <p className="font-mono mt-2 text-neutral-300">ContractEase · Powered by Stellar Network</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
