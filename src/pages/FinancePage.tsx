import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '@/stores';
import { useFinance } from '@/hooks/useFinance';
import { PLANS, abacatePayService, type PlanId } from '@/services/abacatePay';
import { supabase } from '@/lib/supabase';

const PLAN_LIST = [PLANS.free, PLANS.pro, PLANS.enterprise];

export default function FinancePage() {
  const user = useAuthStore(s => s.user);
  const { profile, payments, loading, refresh } = useFinance();
  
  const [activeTab, setActiveTab] = useState<'plan' | 'credits' | 'history'>('plan');
  const [buyingCredits, setBuyingCredits] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'abacatepay' | 'stellar'>('abacatepay');
  const [pixData, setPixData] = useState<{ brCode: string; brCodeBase64: string; id: string } | null>(null);
  const [stellarData, setStellarData] = useState<{ memo: string; walletAddress: string; instruction: string } | null>(null);
  const [error, setError] = useState('');

  const handleBuyCredits = async (amount: number, price: number) => {
    if (!user) {
      setError('Faça login para comprar créditos.');
      return;
    }

    setBuyingCredits(amount);
    setError('');

    try {
      if (paymentMethod === 'abacatepay') {
        const { data, error } = await supabase.functions.invoke('abacatepay-pix', {
          body: {
            amount: Math.round(price * 100),
            description: `Recarga de ${amount} créditos - ContractEase`,
            metadata: { userId: user.id, credits: amount }
          }
        });
        
        if (error || !data || data.success === false) {
          throw error || new Error(data?.error || 'Falha ao gerar checkout');
        }

        if (data.data?.url) {
          window.open(data.data.url, '_blank');
        }
      } else {
        // 1. Verificar se já existe um pagamento pendente para o mesmo valor e créditos
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending_stellar')
          .eq('credits_added', amount)
          .eq('method', 'STELLAR')
          .maybeSingle();

        if (existingPayment) {
          // Mostra dados do pagamento pendente existente (endereço real virá da Edge Function abaixo)
          setStellarData({
            memo: existingPayment.stellar_memo,
            walletAddress: '',
            instruction: 'Aguardando transferência via rede Stellar.'
          });
        }

        // Fluxo Stellar
        const { data, error } = await supabase.functions.invoke('stellar-payment', {
          body: {
            amount: price,
            credits: amount,
            userId: user.id
          }
        });

        if (error || !data || data.success === false) {
          throw error || new Error(data?.error || 'Falha ao gerar pagamento Stellar');
        }

        setStellarData(data.data);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pagamento');
    } finally {
      setBuyingCredits(null);
    }
  };

  const handleUpgrade = async (planId: PlanId) => {
    if (planId === 'free' || !user) return;
    setBuyingCredits(999);
    try {
      if (paymentMethod === 'stellar') {
        const res = await supabase.functions.invoke('stellar-subscription', {
          body: { planId, userId: user.id }
        });
        if(res.data?.success) {
           setStellarData(res.data.data);
           setActiveTab('credits');
        }
      } else {
        const checkout = await abacatePayService.createSubscription(planId, user.email);
        abacatePayService.redirectToCheckout(checkout.url);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar assinatura');
    } finally {
      setBuyingCredits(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlan = profile?.plan || 'free';
  const currentCredits = profile?.credits || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white font-bricolage mb-2">Faturamento & Créditos</h1>
          <p className="text-neutral-400">Gerencie sua assinatura e créditos para ancoragem na rede Stellar.</p>
        </div>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <iconify-icon icon="solar:danger-triangle-bold" />
          {error}
        </motion.div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-emerald-900/40 to-neutral-900 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
          <div className="flex items-center gap-2 mb-1">
            <iconify-icon icon="ph:coins-duotone" class="text-emerald-500 text-lg" />
            <p className="text-neutral-400 text-sm font-medium">Créditos de Ancoragem</p>
          </div>
          <div className="flex items-end gap-2">
            <h2 className="text-4xl font-bold text-white font-bricolage tracking-tight">{currentCredits}</h2>
            <span className="text-sm text-neutral-500 mb-1">disponíveis</span>
          </div>
          <div className="mt-4">
             <div className="w-full bg-black/50 rounded-full h-1.5 mb-2">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min((currentCredits / 100) * 100, 100)}%` }}></div>
             </div>
             <p className="text-xs text-emerald-400 font-medium">1 crédito = 1 registro imutável.</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <p className="text-neutral-400 text-sm font-medium mb-1">Plano Atual</p>
            <h2 className="text-2xl font-bold text-white font-bricolage capitalize">{currentPlan}</h2>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-bold rounded">Ativo</span>
            <button onClick={() => setActiveTab('plan')} className="text-xs text-neutral-500 hover:text-white underline">Mudar plano</button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
          <div>
             <p className="text-neutral-400 text-sm font-medium mb-1">Pagamentos Realizados</p>
             <h2 className="text-2xl font-bold text-white font-bricolage">{payments.length}</h2>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs font-medium text-neutral-500">
            <iconify-icon icon="solar:list-arrow-down-minimalistic-bold" class="text-emerald-500" /> Confira seu histórico abaixo.
          </div>
        </motion.div>
      </div>

      {/* Tabs Layout */}
      <div className="bg-neutral-900 border border-white/5 rounded-2xl flex flex-col min-h-[500px]">
        <div className="flex items-center gap-2 border-b border-white/5 p-2 overflow-x-auto">
          {[
            { id: 'plan', label: 'Meu Plano', icon: 'solar:star-bold-duotone' },
            { id: 'credits', label: 'Comprar Créditos', icon: 'solar:cart-large-bold-duotone' },
            { id: 'history', label: 'Histórico de Faturamento', icon: 'solar:bill-list-bold-duotone' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 ${
                activeTab === tab.id ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <iconify-icon icon={tab.icon} class="text-lg" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 flex-1">
          {activeTab === 'plan' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white">Opções de Assinatura</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLAN_LIST.map(plan => {
                  const isCurrent = currentPlan === plan.id;
                  
                  return (
                    <div key={plan.id} className={`p-6 rounded-2xl flex flex-col border ${isCurrent ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-black/50 border-white/5'}`}>
                      <h4 className={`text-lg font-bold mb-2 ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>{plan.name}</h4>
                      <p className="text-3xl font-bricolage text-white mb-1">{plan.priceDisplay}<span className="text-sm text-neutral-500 font-sans">/{plan.period}</span></p>
                      <p className="text-sm text-neutral-400 mb-6 border-b border-white/5 pb-4">{plan.description}</p>
                      <ul className="space-y-3 mb-8 flex-1">
                        {plan.features.map((f, idx) => (
                          <li key={idx} className="text-sm text-neutral-300 flex items-center gap-2">
                            <iconify-icon icon="solar:check-circle-bold" class="text-emerald-500" /> {f}
                          </li>
                        ))}
                      </ul>
                      <button 
                        disabled={isCurrent || buyingCredits === 999}
                        onClick={() => handleUpgrade(plan.id as PlanId)}
                        className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                          isCurrent 
                            ? 'bg-emerald-500/10 text-emerald-500 cursor-default' 
                            : 'bg-emerald-500 text-black hover:bg-emerald-400'
                        }`}
                      >
                        {isCurrent ? 'Plano Atual' : buyingCredits === 999 ? 'Processando...' : 'Fazer Upgrade'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'credits' && (
            <div className="max-w-2xl mx-auto py-8">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                  <iconify-icon icon="bitcoin-icons:exchange-filled" class="text-5xl text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 font-bricolage">Recarga de Créditos</h3>
                <p className="text-neutral-400 text-sm">Compre créditos avulsos para ancoragem na rede Stellar.</p>
              </div>

              {/* Método de Pagamento Selection */}
              <div className="flex gap-4 mb-8">
                <button 
                  onClick={() => setPaymentMethod('abacatepay')}
                  className={`flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${paymentMethod === 'abacatepay' ? 'bg-emerald-900/20 border-emerald-500/50 text-white' : 'bg-black/40 border-white/5 text-neutral-400 hover:border-white/10'}`}
                >
                  <span className="text-2xl">🥑</span>
                  <span className="font-bold text-sm">Cartão / PIX</span>
                  <span className="text-[10px] opacity-50 uppercase tracking-tighter">AbacatePay</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('stellar')}
                  className={`flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${paymentMethod === 'stellar' ? 'bg-blue-900/20 border-blue-500/50 text-white' : 'bg-black/40 border-white/5 text-neutral-400 hover:border-white/10'}`}
                >
                  <iconify-icon icon="simple-icons:stellar" class="text-2xl text-white" />
                  <span className="font-bold text-sm">Rede Stellar</span>
                  <span className="text-[10px] opacity-50 uppercase tracking-tighter">Cripto (XLM/USDC)</span>
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { amount: 50, price: 29.90, label: 'Pacote Básico' },
                  { amount: 200, price: 99.90, label: 'Pacote Pro', popular: true },
                  { amount: 1000, price: 399.90, label: 'Pacote Volume' },
                ].map(pkg => (
                  <div key={pkg.amount} className={`bg-black/50 border rounded-xl p-4 flex items-center justify-between ${pkg.popular ? 'border-emerald-500/50 relative overflow-hidden' : 'border-white/5'}`}>
                    {pkg.popular && <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">MAIS POPULAR</div>}
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${paymentMethod === 'stellar' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
                        <iconify-icon 
                          icon="ph:coins-duotone" 
                          className={`text-2xl ${paymentMethod === 'stellar' ? 'text-blue-500' : 'text-emerald-500'}`} 
                        />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">+{pkg.amount} Créditos</p>
                        <p className="text-xs text-neutral-500">{pkg.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bricolage text-white">R$ {pkg.price.toFixed(2).replace('.', ',')}</p>
                      <button 
                        disabled={!!buyingCredits}
                        onClick={() => handleBuyCredits(pkg.amount, pkg.price)}
                        className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors disabled:opacity-50 ${paymentMethod === 'stellar' ? 'bg-blue-500 text-white hover:bg-blue-400' : 'bg-emerald-500 text-black hover:bg-emerald-400'}`}
                      >
                        {buyingCredits === pkg.amount ? 'Processando...' : 'Comprar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Histórico de Movimentações</h3>
                <button onClick={refresh} className="p-2 hover:bg-white/5 rounded-lg text-neutral-400 transition-colors">
                  <iconify-icon icon="solar:refresh-bold" />
                </button>
              </div>
              
              {payments.length === 0 ? (
                <div className="text-center py-20 border border-white/5 border-dashed rounded-2xl">
                  <p className="text-neutral-500">Nenhuma transação encontrada.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-neutral-500 uppercase tracking-wider">
                        <th className="pb-3 font-medium">Data</th>
                        <th className="pb-3 font-medium">Descrição</th>
                        <th className="pb-3 font-medium">Valor</th>
                        <th className="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {payments.map(tx => (
                        <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-4 text-neutral-400">{new Date(tx.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="py-4">
                            <p className="text-white font-medium">
                              {tx.plan_id ? `Assinatura Plano ${tx.plan_id.toUpperCase()}` : `Recarga de ${tx.credits_added} créditos`}
                            </p>
                            <p className="text-xs text-neutral-500 capitalize">{tx.method || 'Pagamento Digital'}</p>
                          </td>
                          <td className="py-4 text-white font-mono">
                            {tx.method === 'STELLAR' ? `${tx.amount} BRL` : `R$ ${Number(tx.amount).toFixed(2)}`}
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${
                              tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 
                              tx.status === 'pending_stellar' ? 'bg-blue-500/10 text-blue-400' :
                              'bg-amber-500/10 text-amber-400'
                            }`}>
                              {tx.status === 'completed' ? 'Concluído' : 
                               tx.status === 'pending_stellar' ? 'Aguardando Stellar' : 'Pendente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stellar Modal */}
      <AnimatePresence>
        {stellarData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-neutral-900 border border-white/10 rounded-3xl p-8 w-full max-w-sm text-center relative">
              <button onClick={() => setStellarData(null)} className="absolute top-4 right-4 text-neutral-400 hover:text-white p-2">
                <iconify-icon icon="solar:close-circle-bold" class="text-2xl" />
              </button>
              
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                  <iconify-icon icon="simple-icons:stellar" class="text-3xl text-white" />
                </div>
                <h3 className="text-xl font-bold text-white font-bricolage">Pagamento Stellar</h3>
                <p className="text-sm text-neutral-400 mt-1">Transfira o valor correspondente para o endereço abaixo.</p>
              </div>

              <div className="bg-black/40 border border-white/5 p-4 rounded-xl mb-6 text-left space-y-4">
                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center bg-white p-4 rounded-xl mb-2">
                  <QRCodeSVG 
                    value={`stellar:pay?destination=${stellarData.walletAddress}&memo=${stellarData.memo}&memo_type=MEMO_TEXT`}
                    size={160}
                    level="H"
                    includeMargin={true}
                  />
                  <p className="text-[9px] text-neutral-500 mt-2 font-bold uppercase tracking-widest">Scan to Pay</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase font-bold mb-1">Carteira de Destino</p>
                    <div className="flex items-center gap-2 bg-black/60 p-2 rounded-lg border border-white/5">
                      <code className="text-[10px] break-all text-blue-400 font-mono flex-1">{stellarData.walletAddress}</code>
                      <button 
                        onClick={() => navigator.clipboard.writeText(stellarData.walletAddress)}
                        className="p-1 hover:bg-white/10 rounded text-neutral-400"
                      >
                        <iconify-icon icon="solar:copy-bold" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase font-bold mb-1">MEMO ID (Obrigatório)</p>
                    <div className="flex items-center gap-2 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                      <code className="text-xl font-black text-amber-500 font-mono flex-1 text-center tracking-widest">{stellarData.memo}</code>
                      <button 
                        onClick={() => navigator.clipboard.writeText(stellarData.memo)}
                        className="p-1 hover:bg-amber-500/10 rounded text-amber-500"
                      >
                        <iconify-icon icon="solar:copy-bold" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-[10px] text-blue-400 text-center leading-relaxed">
                    O sistema identificará seu pagamento automaticamente em até 2 minutos após a confirmação na rede.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setStellarData(null)}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
              >
                Entendi, vou pagar agora
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
