import { useState } from 'react';
import { motion } from 'motion/react';
import type { Contract, Party } from '@/types';
import { signingService } from '@/services/supabaseService';

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
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState('');

  const handleSign = async () => {
    if (!lgpdConsent) {
      setError('Você precisa consentir com a política de dados (LGPD) para prosseguir.');
      return;
    }
    setIsSigning(true);
    setError('');
    try {
      await signingService.signParty(party.id, {
        cpf: cpf.replace(/\D/g, '') || undefined,
        lgpdConsent,
      });
      await signingService.checkAndCompleteContract(contract.id);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar assinatura. Tente novamente.');
    } finally {
      setIsSigning(false);
    }
  };

  const roleLabel: Record<string, string> = {
    creator: 'Contratante',
    counterparty: 'Contratado',
    witness: 'Testemunha',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-neutral-900 border border-white/10 p-8 rounded-2xl w-full max-w-lg shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <iconify-icon icon="solar:pen-bold" class="text-xl text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Assinar Documento</h2>
              <p className="text-xs text-neutral-500">Assinatura Eletrônica · Validade Jurídica</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
          >
            <iconify-icon icon="solar:close-bold" class="text-lg" />
          </button>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-xl p-4 mb-6">
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
            CPF{' '}
            <span className="text-neutral-600 text-xs">(opcional — fortalece a validade do documento)</span>
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
            Declaro que li e concordo com todos os termos, condições e cláusulas deste documento. Consinto com a coleta e processamento dos meus dados pessoais para fins de assinatura eletrônica, em conformidade com a{' '}
            <span className="text-emerald-400 font-medium">Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</span>.
          </span>
        </label>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <iconify-icon icon="solar:danger-bold" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/5 text-neutral-300 font-medium text-sm hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSign}
            disabled={isSigning || !lgpdConsent}
            className="flex-[2] py-3 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSigning ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <iconify-icon icon="solar:pen-bold" class="text-base" />
            )}
            {isSigning ? 'Registrando assinatura...' : 'Assinar Documento'}
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-5 text-[10px] text-neutral-600">
          <span className="flex items-center gap-1">
            <iconify-icon icon="solar:shield-check-bold" class="text-neutral-500" />
            Assinatura Eletrônica
          </span>
          <span className="flex items-center gap-1">
            <iconify-icon icon="solar:lock-bold" class="text-neutral-500" />
            Criptografia SSL
          </span>
          <span className="flex items-center gap-1">
            <iconify-icon icon="solar:globus-bold" class="text-neutral-500" />
            Stellar Network
          </span>
        </div>
      </motion.div>
    </div>
  );
}
