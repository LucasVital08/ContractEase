import { motion } from 'motion/react';
import type { Contract } from '@/types';

interface SignatureCertificateProps {
  contract: Contract;
  onClose: () => void;
}

export default function SignatureCertificate({ contract, onClose }: SignatureCertificateProps) {
  const signedParties = contract.parties.filter(p => p.signedAt);
  const allSigned = contract.parties.every(p => p.signedAt);

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
            <div className="space-y-3">
              <div>
                <p className="text-neutral-400 text-xs mb-1">Hash SHA-256 do Contrato</p>
                <p className="font-mono text-xs bg-neutral-100 p-2 rounded break-all">{contract.contractHash || 'Aguardando geração...'}</p>
              </div>
              {contract.stellarTxHash && (
                <div>
                  <p className="text-neutral-400 text-xs mb-1">Transaction Hash (Stellar Blockchain)</p>
                  <a 
                    href={`https://stellar.expert/explorer/testnet/tx/${contract.stellarTxHash}`} 
                    target="_blank" 
                    className="font-mono text-xs text-emerald-600 hover:underline bg-emerald-50 p-2 rounded break-all block"
                  >
                    {contract.stellarTxHash}
                  </a>
                </div>
              )}
            </div>
          </div>

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
                        <p className="text-xs capitalize">{party.signatureType || 'N/A'}</p>
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
