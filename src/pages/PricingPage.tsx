import { useState } from 'react';
import { motion } from 'motion/react';
import { useAuthStore } from '@/stores';
import { PLANS, abacatePayService, type PlanId } from '@/services/abacatePay';

const PLAN_LIST = [PLANS.free, PLANS.pro, PLANS.enterprise];

export default function PricingPage() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSelectPlan = async (planId: PlanId) => {
    if (planId === 'free') return;
    if (!user) {
      setError('Faça login para assinar um plano.');
      return;
    }

    setLoading(planId);
    setError('');

    try {
      const checkout = await abacatePayService.createSubscription(planId, user.email);
      abacatePayService.redirectToCheckout(checkout.url);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pagamento');
      setLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-white font-bricolage mb-4">Escolha seu Plano</h1>
        <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
          Evolua do rascunho em papel para a segurança da blockchain. Cancele ou mude de plano quando quiser.
        </p>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center flex items-center justify-center gap-2">
          <iconify-icon icon="solar:danger-triangle-bold" />
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {PLAN_LIST.map((plan, i) => {
          const isPopular = plan.id === 'pro';
          const isCurrent = plan.id === (user?.plan || 'free');
          const isLoading = loading === plan.id;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex flex-col p-8 rounded-3xl border ${
                isPopular
                  ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_40px_-15px_rgba(16,185,129,0.3)]'
                  : 'bg-neutral-900 border-white/5'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 text-black text-xs font-bold rounded-full">
                  Mais Escolhido
                </div>
              )}

              <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
              <p className="text-sm text-neutral-400 mb-6">{plan.description}</p>

              <div className="mb-8">
                <span className="text-4xl font-bold text-white font-bricolage">{plan.priceDisplay}</span>
                <span className="text-neutral-500">{plan.period}</span>
              </div>

              <button
                onClick={() => handleSelectPlan(plan.id as PlanId)}
                disabled={isCurrent || isLoading}
                className={`w-full py-3 rounded-xl font-bold transition-all mb-8 flex items-center justify-center gap-2 ${
                  isCurrent
                    ? 'bg-white/5 text-neutral-500 cursor-default'
                    : isPopular
                      ? 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                      : 'bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isCurrent ? (
                  'Plano Atual'
                ) : plan.id === 'enterprise' ? (
                  'Falar com Consultor'
                ) : (
                  <>
                    <iconify-icon icon="solar:card-bold" />
                    Assinar com PIX ou Cartão
                  </>
                )}
              </button>

              <ul className="space-y-4 mt-auto">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-neutral-300">
                    <iconify-icon icon="solar:check-circle-bold" class="text-emerald-500 text-lg shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>

      {/* Payment methods badge */}
      <div className="flex flex-col items-center gap-4 pt-8 border-t border-white/5">
        <p className="text-neutral-500 text-sm">Pagamentos processados com segurança por</p>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#1a7a1a]/10 border border-[#1a7a1a]/20 flex items-center gap-2">
            <span className="text-2xl">🥑</span>
            <span className="text-sm font-bold text-[#2ecc71]">AbacatePay</span>
          </div>
          <div className="flex gap-2 text-neutral-500 text-xs">
            <span className="px-2 py-1 rounded bg-white/5 border border-white/10">PIX</span>
            <span className="px-2 py-1 rounded bg-white/5 border border-white/10">Cartão</span>
            <span className="px-2 py-1 rounded bg-white/5 border border-white/10">Boleto</span>
          </div>
        </div>
      </div>
    </div>
  );
}
