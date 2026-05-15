import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Contract, Party } from '@/types';
import { signingService } from '@/services/supabaseService';
import { generateContractHash, serializeContract, anchorOnStellar, getStellarExplorerUrl } from '@/services/stellar';
import { supabase } from '@/lib/supabase';

type Step = 'form' | 'anchoring' | 'done';

interface Props {
  contract: Contract;
  party: Party;
  onClose: () => void;
  onSuccess: () => void;
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export default function SignDocumentModal({ contract, party, onClose, onSuccess }: Props) {
  const [cpf, setCpf] = useState('');
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState('');
  const [signedAt, setSignedAt] = useState('');
  const [txHash, setTxHash] = useState('');
  const [anchorFailed, setAnchorFailed] = useState(false);

  const roleLabel: Record<string, string> = {
    creator: 'Contratante',
    counterparty: 'Contratado',
    witness: 'Testemunha',
  };

  const handleSign = async () => {
    if (!lgpdConsent) {
      setError('Você precisa consentir com a política de dados (LGPD) para prosseguir.');
      return;
    }
    setError('');

    const now = new Date().toISOString();
    setSignedAt(now);
    setStep('anchoring');

    // 1. Registrar assinatura no banco
    try {
      await signingService.signParty(party.id, {
        cpf: cpf.replace(/\D/g, '') || undefined,
        lgpdConsent,
      });
      await signingService.checkAndCompleteContract(contract.id);
      onSuccess(); // dispara refetch silencioso no pai
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar assinatura.');
      setStep('form');
      return;
    }

    // 2. Ancorar na Stellar Testnet
    try {
      const hash = await generateContractHash(
        serializeContract({
          title: contract.title,
          description: contract.description,
          clauses: contract.clauses.map(c => ({ title: c.title, content: c.content, order: c.order })),
          parties: contract.parties.map(p => ({ name: p.name, email: p.email })),
        })
      );

      const result = await anchorOnStellar(hash);

      if (result.success && result.txHash) {
        setTxHash(result.txHash);
        await supabase
          .from('contracts')
          .update({ stellar_tx_hash: result.txHash, contract_hash: hash })
          .eq('id', contract.id);
        onSuccess(); // segundo refetch com tx hash
      } else {
        setAnchorFailed(true);
      }
    } catch {
      setAnchorFailed(true);
    }

    setStep('done');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <AnimatePresence mode="wait">

        {/* ── FORMULÁRIO ─────────────────────────────────── */}
        {step === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="bg-neutral-900 border border-white/10 p-8 rounded-2xl w-full max-w-lg shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <iconify-icon icon="solar:pen-bold" class="text-xl text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Assinar Documento</h2>
                  <p className="text-xs text-neutral-500">Assinatura Eletrônica · Stellar Blockchain</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors">
                <iconify-icon icon="solar:close-bold" class="text-lg" />
              </button>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-xl p-4 mb-5">
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5">Documento</p>
              <p className="text-white font-semibold">{contract.title}</p>
              {contract.description && (
                <p className="text-neutral-500 text-xs mt-1 line-clamp-2">{contract.description}</p>
              )}
              <div className="flex items-center gap-6 mt-3 pt-3 border-t border-white/5">
                <div>
                  <p className="text-[10px] text-neutral-500 uppercase mb-0.5">Signatário</p>
                  <p className="text-sm text-white font-medium">{party.name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-500 uppercase mb-0.5">Função</p>
                  <p className="text-sm text-neutral-300">{roleLabel[party.role] ?? party.role}</p>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-500 uppercase mb-0.5">E-mail</p>
                  <p className="text-sm text-neutral-300">{party.email}</p>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm text-neutral-400 mb-1.5">
                CPF <span className="text-neutral-600 text-xs">(opcional)</span>
              </label>
              <input
                value={cpf}
                onChange={e => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 font-mono text-sm transition-colors"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer mb-5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors bg-white/[0.02]">
              <input
                type="checkbox"
                checked={lgpdConsent}
                onChange={e => { setLgpdConsent(e.target.checked); setError(''); }}
                className="mt-0.5 w-4 h-4 accent-emerald-500 flex-shrink-0 cursor-pointer"
              />
              <span className="text-xs text-neutral-400 leading-relaxed select-none">
                Declaro que li e concordo com todos os termos e cláusulas deste documento. Consinto com a coleta dos meus dados em conformidade com a{' '}
                <span className="text-emerald-400 font-medium">LGPD — Lei nº 13.709/2018</span>.
              </span>
            </label>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <iconify-icon icon="solar:danger-bold" /> {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/5 text-neutral-300 font-medium text-sm hover:bg-white/10 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSign}
                disabled={!lgpdConsent}
                className="flex-[2] py-3 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <iconify-icon icon="solar:pen-bold" class="text-base" />
                Assinar Documento
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-5 text-[10px] text-neutral-600">
              <span className="flex items-center gap-1"><iconify-icon icon="solar:shield-check-bold" /> Assinatura Eletrônica</span>
              <span className="flex items-center gap-1"><iconify-icon icon="solar:lock-bold" /> SSL</span>
              <span className="flex items-center gap-1"><iconify-icon icon="solar:globus-bold" /> Stellar Network</span>
            </div>
          </motion.div>
        )}

        {/* ── ANCORANDO (loading) ────────────────────────── */}
        {step === 'anchoring' && (
          <motion.div
            key="anchoring"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-white/10 p-10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col items-center text-center"
          >
            {/* Checkmark animado */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mb-6"
            >
              <iconify-icon icon="solar:check-circle-bold" class="text-4xl text-emerald-400" />
            </motion.div>

            <h2 className="text-xl font-bold text-white mb-1">Assinatura Registrada!</h2>
            <p className="text-neutral-400 text-sm mb-2">{party.name}</p>
            <p className="text-xs text-neutral-600 mb-8">
              {new Date(signedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>

            <div className="w-full bg-black/40 border border-white/5 rounded-xl p-4 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <iconify-icon icon="solar:globus-bold" class="text-violet-400 text-sm" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-white">Ancorando na Stellar Testnet</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Gerando hash SHA-256 e submetendo transação...</p>
                </div>
                <div className="ml-auto w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              </div>
            </div>
            <p className="text-[10px] text-neutral-600">Isso garante auditabilidade imutável do documento.</p>
          </motion.div>
        )}

        {/* ── SUCESSO FINAL ──────────────────────────────── */}
        {step === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
          >
            {/* Header verde */}
            <div className="bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border-b border-emerald-500/20 p-8 flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 250, damping: 18, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mb-4"
              >
                <iconify-icon icon="solar:check-circle-bold" class="text-5xl text-emerald-400" />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <h2 className="text-2xl font-bold text-white font-bricolage">Documento Assinado!</h2>
                <p className="text-emerald-400 text-sm mt-1">Assinatura eletrônica registrada com sucesso</p>
              </motion.div>
            </div>

            <div className="p-6 space-y-4">
              {/* Dados da assinatura */}
              <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1">Signatário</p>
                    <p className="text-sm text-white font-semibold">{party.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1">Função</p>
                    <p className="text-sm text-neutral-300">{roleLabel[party.role] ?? party.role}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1">Data/Hora</p>
                    <p className="text-sm text-neutral-300">
                      {new Date(signedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1">Documento</p>
                  <p className="text-sm text-white font-medium">{contract.title}</p>
                </div>
              </div>

              {/* Status da blockchain */}
              {txHash ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <iconify-icon icon="solar:shield-check-bold-duotone" class="text-lg text-emerald-400" />
                    <p className="text-sm font-bold text-emerald-400">Ancorado na Stellar Testnet</p>
                  </div>
                  <p className="text-[11px] text-neutral-500 mb-1">Hash da transação</p>
                  <p className="text-xs text-neutral-300 font-mono break-all leading-relaxed">{txHash}</p>
                  <a
                    href={getStellarExplorerUrl(txHash, 'testnet')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors group"
                  >
                    <iconify-icon icon="solar:link-bold" class="text-sm" />
                    Ver transação no Stellar Expert
                    <iconify-icon icon="solar:arrow-right-up-bold" class="text-sm group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                </motion.div>
              ) : (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                  <iconify-icon icon="solar:danger-triangle-bold" class="text-amber-400 text-base flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-400">Assinatura registrada</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {anchorFailed
                        ? 'A ancoragem blockchain falhou, mas sua assinatura foi salva. Tente ancorar manualmente.'
                        : 'A ancoragem na blockchain está pendente.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Selos de segurança */}
              <div className="flex items-center justify-center gap-6 py-1">
                {[
                  { icon: 'solar:shield-check-bold', label: 'ICP-Brasil' },
                  { icon: 'solar:lock-password-bold', label: 'SHA-256' },
                  { icon: 'solar:server-bold', label: 'Imutável' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-1.5 text-[10px] text-neutral-600">
                    <iconify-icon icon={s.icon} class="text-neutral-500 text-sm" />
                    {s.label}
                  </div>
                ))}
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-all"
              >
                Concluir
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
