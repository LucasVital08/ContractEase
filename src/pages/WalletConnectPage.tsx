/**
 * Carteira — tela única de conexão.
 *
 * Substitui a antiga divisão confusa entre "botão da Freighter no topo" e
 * "página /wallet com carteira embutida". Agora existe UM lugar onde o usuário
 * conecta, entende o que está acontecendo e vê se está tudo pronto.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useNotificationStore, useWalletStore } from '@/stores';
import { Caveat, Explain } from '@/components/guide/Explain';
import {
  WALLET_PROVIDERS,
  WalletError,
  explorerAccountUrl,
  shortenAddress,
  type StellarNetwork,
  type WalletProviderId,
} from '@/services/wallet';

export default function WalletConnectPage() {
  const notify = useNotificationStore((s) => s.add);
  const {
    isConnected,
    address,
    network,
    provider,
    connecting,
    detected,
    xlm,
    accountExists,
    refresh,
    connect,
    fund,
    disconnect,
  } = useWalletStore();

  const [targetNetwork, setTargetNetwork] = useState<StellarNetwork>('testnet');
  const [busy, setBusy] = useState<string | null>(null);
  const [lastError, setLastError] = useState<{ message: string; fix?: string } | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (network === 'testnet' || network === 'mainnet') setTargetNetwork(network);
  }, [network]);

  const handleConnect = useCallback(
    async (id: WalletProviderId) => {
      setLastError(null);
      try {
        const state = await connect(id, targetNetwork);
        notify({
          type: 'success',
          title: 'Carteira conectada',
          message: `${shortenAddress(state.address ?? '')} · ${state.network === 'testnet' ? 'rede de testes' : 'rede real'}`,
        });
      } catch (err) {
        const walletError = err instanceof WalletError ? err : null;
        setLastError({
          message: walletError?.message ?? (err as Error)?.message ?? 'Não foi possível conectar.',
          fix: walletError?.fix,
        });
      }
    },
    [connect, notify, targetNetwork],
  );

  const handleFund = useCallback(async () => {
    setBusy('fund');
    setLastError(null);
    try {
      await fund();
      notify({
        type: 'success',
        title: 'Saldo de teste liberado',
        message: 'Sua conta foi criada na rede de testes e já tem XLM para pagar as taxas.',
      });
    } catch (err) {
      const walletError = err instanceof WalletError ? err : null;
      setLastError({
        message: walletError?.message ?? (err as Error)?.message ?? 'Falha ao liberar saldo.',
        fix: walletError?.fix,
      });
    } finally {
      setBusy(null);
    }
  }, [fund, notify]);

  const ready = isConnected && accountExists;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">Carteira</p>
        <h1 className="font-bricolage text-2xl font-bold text-white sm:text-3xl">
          Conecte uma carteira para assinar seus contratos
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-neutral-400">
          É o único pré-requisito técnico do ContractEase. Leva menos de um minuto e você só precisa fazer uma vez.
        </p>
      </header>

      <Explain
        what="Seu carimbo digital: uma chave secreta que só você tem e que serve para assinar."
        why="É o que permite qualquer pessoa conferir a assinatura na blockchain, sem depender do ContractEase."
        how={[
          'Escolha uma carteira abaixo. Se você já usa MetaMask, fique com ela.',
          'Clique em conectar e aprove a janela da extensão.',
          'Na rede de testes, libere o saldo grátis para pagar as taxas.',
        ]}
      />

      {/* Seleção de rede — decisão que muda tudo, então fica antes de conectar. */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Onde você quer operar agora?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <NetworkOption
            selected={targetNetwork === 'testnet'}
            onClick={() => setTargetNetwork('testnet')}
            icon="solar:test-tube-bold-duotone"
            title="Rede de testes"
            description="Dinheiro de mentira, tudo grátis. É aqui que você experimenta sem risco."
            badge="recomendado para começar"
          />
          <NetworkOption
            selected={targetNetwork === 'mainnet'}
            onClick={() => setTargetNetwork('mainnet')}
            icon="solar:shield-check-bold-duotone"
            title="Rede real"
            description="Valores de verdade e taxas reais em XLM. Use quando o contrato for para valer."
            badge="execução real"
          />
        </div>
        {targetNetwork === 'mainnet' && (
          <Caveat>Na rede real cada transação custa XLM de verdade e não pode ser desfeita.</Caveat>
        )}
      </section>

      {/* Estado conectado */}
      {isConnected && address && (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-5 ${ready ? 'border-emerald-400/30 bg-emerald-500/[0.06]' : 'border-amber-400/25 bg-amber-500/[0.05]'}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Conectado via {WALLET_PROVIDERS.find((p) => p.meta.id === provider)?.meta.name ?? provider}
              </p>
              <p className="mt-2 break-all font-mono text-sm text-white">{address}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full border border-white/12 bg-black/30 px-2.5 py-1 text-neutral-300">
                  {network === 'testnet' ? 'rede de testes' : 'rede real'}
                </span>
                <span className="rounded-full border border-white/12 bg-black/30 px-2.5 py-1 text-neutral-300">
                  {xlm === null ? 'saldo —' : `${Number(xlm).toFixed(2)} XLM`}
                </span>
                <a
                  href={explorerAccountUrl(address, (network as StellarNetwork) ?? 'testnet')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-neutral-400 transition-colors hover:text-white"
                >
                  ver na blockchain
                  <iconify-icon icon="solar:arrow-right-up-linear" class="text-xs" />
                </a>
              </div>
            </div>

            <button
              onClick={disconnect}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-neutral-400 transition-colors hover:border-red-400/30 hover:text-red-300"
            >
              Desconectar
            </button>
          </div>

          {!accountExists && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="text-sm font-semibold text-white">Falta um passo: ativar a conta na blockchain</p>
              <p className="mt-1 text-xs leading-6 text-neutral-400">
                Em Stellar, uma conta só passa a existir quando recebe um saldo inicial. Sem isso, nenhuma assinatura
                pode ser registrada.
              </p>
              {network === 'testnet' ? (
                <button
                  onClick={handleFund}
                  disabled={busy === 'fund'}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                >
                  {busy === 'fund' && <iconify-icon icon="svg-spinners:ring-resize" class="text-base" />}
                  Liberar saldo de teste (grátis)
                </button>
              ) : (
                <p className="mt-3 text-xs text-amber-200/90">
                  Na rede real, envie ao menos 1 XLM para este endereço a partir de uma corretora ou de outra carteira.
                </p>
              )}
            </div>
          )}

          {ready && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                <iconify-icon icon="solar:check-circle-bold" class="text-base" />
                Tudo pronto. Você já pode criar e assinar contratos.
              </p>
              <Link
                to="/criar"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-emerald-400"
              >
                Criar meu primeiro contrato
                <iconify-icon icon="solar:arrow-right-linear" class="text-sm" />
              </Link>
            </div>
          )}
        </motion.section>
      )}

      {lastError && (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/[0.06] p-4">
          <p className="flex items-start gap-2 text-sm font-medium text-red-200">
            <iconify-icon icon="solar:danger-circle-bold" class="mt-0.5 shrink-0 text-base" />
            {lastError.message}
          </p>
          {lastError.fix && <p className="mt-2 pl-6 text-xs leading-6 text-red-200/75">{lastError.fix}</p>}
        </div>
      )}

      {/* Provedores */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">
          {isConnected ? 'Trocar de carteira' : 'Escolha sua carteira'}
        </h2>

        <div className="space-y-3">
          {WALLET_PROVIDERS.map((walletProvider) => {
            const meta = walletProvider.meta;
            const detection = detected.find((d) => d.id === meta.id);
            const installed = detection?.installed ?? false;
            const isActive = provider === meta.id && isConnected;
            const disabledForNetwork = meta.id === 'app' && targetNetwork === 'mainnet';

            return (
              <article
                key={meta.id}
                className={`rounded-2xl border p-5 transition-colors ${
                  isActive ? 'border-emerald-400/35 bg-emerald-500/[0.05]' : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-xl text-neutral-300">
                      <iconify-icon icon={meta.icon} class="text-xl" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-white">{meta.name}</h3>
                        {meta.recommended && (
                          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                            recomendada
                          </span>
                        )}
                        {isActive && (
                          <span className="rounded-full border border-white/12 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-300">
                            em uso
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 max-w-xl text-sm leading-6 text-neutral-400">{meta.tagline}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {!installed && meta.installUrl ? (
                      <a
                        href={meta.installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition-colors hover:border-white/25 hover:text-white"
                      >
                        Instalar
                        <iconify-icon icon="solar:arrow-right-up-linear" class="text-sm" />
                      </a>
                    ) : (
                      <button
                        onClick={() => handleConnect(meta.id)}
                        disabled={connecting || isActive || disabledForNetwork}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                          meta.recommended
                            ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                            : 'border border-white/12 text-neutral-100 hover:border-white/25'
                        }`}
                      >
                        {connecting && <iconify-icon icon="svg-spinners:ring-resize" class="text-base" />}
                        {isActive ? 'Conectada' : meta.id === 'app' ? 'Criar carteira de teste' : `Conectar ${meta.name}`}
                      </button>
                    )}
                  </div>
                </div>

                <ol className="mt-4 space-y-2 border-t border-white/8 pt-4">
                  {meta.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-[13px] leading-6 text-neutral-400">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 text-[10px] font-bold text-neutral-500">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                {meta.caveat && (
                  <p className="mt-3 flex gap-2 text-xs leading-6 text-neutral-500">
                    <iconify-icon icon="solar:info-circle-linear" class="mt-0.5 shrink-0 text-sm" />
                    {meta.caveat}
                  </p>
                )}

                {disabledForNetwork && (
                  <p className="mt-3 text-xs text-amber-300/80">
                    Indisponível na rede real por segurança — use MetaMask ou Freighter para valores de verdade.
                  </p>
                )}

                {!installed && detection?.reason && (
                  <p className="mt-3 text-xs text-neutral-500">{detection.reason}</p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function NetworkOption({
  selected,
  onClick,
  icon,
  title,
  description,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-2xl border p-4 text-left transition-all ${
        selected ? 'border-emerald-400/45 bg-emerald-500/[0.07]' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
      }`}
    >
      <div className="flex items-center gap-2">
        <iconify-icon icon={icon} class={`text-lg ${selected ? 'text-emerald-300' : 'text-neutral-500'}`} />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="mt-1.5 text-xs leading-6 text-neutral-400">{description}</p>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">{badge}</p>
    </button>
  );
}
