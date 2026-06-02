import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { useNotificationStore } from '@/stores';
import {
  ensureWallet,
  fundWithFriendbot,
  getBalances,
  ensureTrustline,
  explorerAccountUrl,
  TEST_ANCHOR,
  type EmbeddedWallet,
  type WalletBalance,
} from '@/services/embeddedWallet';
import {
  fetchAnchorToml,
  getAnchorAuthToken,
  initiateDeposit,
  getAnchorTransaction,
  isTerminalStatus,
  type AnchorTransaction,
} from '@/services/anchorService';

export default function WalletPage() {
  const notify = useNotificationStore((s) => s.add);
  const [wallet, setWallet] = useState<EmbeddedWallet | null>(null);
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [depositTx, setDepositTx] = useState<AnchorTransaction | null>(null);

  const xlmBalance = balances.find((b) => b.isNative)?.balance ?? '0';
  const srtBalance =
    balances.find(
      (b) => b.assetCode === TEST_ANCHOR.asset.code && b.assetIssuer === TEST_ANCHOR.asset.issuer,
    )?.balance ?? null;
  const accountExists = balances.length > 0;
  const hasTrustline = srtBalance !== null;

  const refreshBalances = useCallback(async (publicKey: string) => {
    setLoading(true);
    try {
      const bal = await getBalances(publicKey);
      setBalances(bal);
    } catch (err: any) {
      notify({ type: 'error', title: 'Erro ao ler saldos', message: err?.message });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const w = ensureWallet();
    setWallet(w);
    refreshBalances(w.publicKey);
  }, [refreshBalances]);

  const handleFriendbot = async () => {
    if (!wallet) return;
    setBusy('friendbot');
    try {
      await fundWithFriendbot(wallet.publicKey);
      notify({ type: 'success', title: 'Conta fundada', message: '10.000 XLM testnet liberados.' });
      await refreshBalances(wallet.publicKey);
    } catch (err: any) {
      notify({ type: 'error', title: 'Friendbot falhou', message: err?.message });
    } finally {
      setBusy(null);
    }
  };

  const handleTrustline = async () => {
    if (!wallet) return;
    setBusy('trustline');
    try {
      const { added } = await ensureTrustline(wallet.secret, TEST_ANCHOR.asset);
      notify({
        type: 'success',
        title: added ? `Trustline ${TEST_ANCHOR.asset.code} adicionada` : `Trustline já existia`,
      });
      await refreshBalances(wallet.publicKey);
    } catch (err: any) {
      notify({ type: 'error', title: 'Falha ao adicionar trustline', message: err?.message });
    } finally {
      setBusy(null);
    }
  };

  const handleDeposit = async () => {
    if (!wallet) return;
    setBusy('deposit');
    setDepositTx(null);
    try {
      const toml = await fetchAnchorToml(TEST_ANCHOR.domain);
      if (!toml.WEB_AUTH_ENDPOINT || !toml.TRANSFER_SERVER_SEP0024) {
        throw new Error('TOML da anchor sem WEB_AUTH_ENDPOINT ou TRANSFER_SERVER_SEP0024');
      }
      const jwt = await getAnchorAuthToken(toml.WEB_AUTH_ENDPOINT, wallet.publicKey, wallet.secret);
      const init = await initiateDeposit(
        toml.TRANSFER_SERVER_SEP0024,
        jwt,
        wallet.publicKey,
        TEST_ANCHOR.asset.code,
      );

      // Abre popup com o widget interativo da anchor
      const popup = window.open(init.interactiveUrl, 'anchor-deposit', 'width=520,height=720');
      if (!popup) {
        notify({
          type: 'warning',
          title: 'Bloqueado pelo navegador',
          message: 'Permita popups e clique em Depositar de novo.',
        });
      }

      // Polling do status até terminal
      const pollUntilDone = async () => {
        for (let i = 0; i < 60; i++) {
          // até 5min (60 * 5s)
          await new Promise((r) => setTimeout(r, 5000));
          try {
            const tx = await getAnchorTransaction(toml.TRANSFER_SERVER_SEP0024!, jwt, init.id);
            setDepositTx(tx);
            if (isTerminalStatus(tx.status)) {
              if (tx.status === 'completed') {
                notify({
                  type: 'success',
                  title: 'Depósito completo',
                  message: `+${tx.amount_out || '?'} ${TEST_ANCHOR.asset.code} na sua carteira.`,
                });
                await refreshBalances(wallet.publicKey);
              } else {
                notify({
                  type: 'error',
                  title: 'Depósito não concluiu',
                  message: `Status: ${tx.status}. ${tx.message ?? ''}`,
                });
              }
              return;
            }
          } catch {
            /* network blip, segue tentando */
          }
        }
        notify({ type: 'warning', title: 'Tempo limite', message: 'Verifique o status mais tarde.' });
      };
      pollUntilDone();
    } catch (err: any) {
      notify({ type: 'error', title: 'Falha ao iniciar depósito', message: err?.message });
    } finally {
      setBusy(null);
    }
  };

  if (!wallet) {
    return <div className="p-8 text-app-text-muted">Carregando carteira...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bricolage text-3xl font-bold text-app-text">Carteira</h1>
            <span className="rounded-full border border-amber-400/24 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              testnet
            </span>
          </div>
          <p className="mt-1 text-sm text-app-text-muted">
            Carteira Stellar embedded (gerada localmente). Use pra testar depósitos via anchor com asset SRT (BRZ-DEMO).
          </p>
        </div>
        <a
          href={explorerAccountUrl(wallet.publicKey)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-app-text-muted hover:text-app-text"
        >
          <iconify-icon icon="solar:square-arrow-right-up-bold-duotone" class="text-sm" />
          Auditar no Stellar Expert
        </a>
      </div>

      {/* Carteira pública */}
      <section className="rounded-2xl border border-app-border bg-neutral-900/70 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-app-text-muted">Endereço público</p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <code className="rounded-lg border border-app-border bg-black/30 px-3 py-2 text-xs text-violet-300 break-all">
            {wallet.publicKey}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(wallet.publicKey);
              notify({ type: 'success', title: 'Copiado' });
            }}
            className="rounded-lg border border-app-border bg-white/[0.04] p-2 text-app-text-muted hover:text-app-text"
            title="Copiar"
          >
            <iconify-icon icon="solar:copy-bold-duotone" class="text-sm" />
          </button>
        </div>
        <p className="mt-3 text-[11px] text-amber-300/80">
          ⚠️ Carteira de DEMO em testnet. A secret está só no teu navegador (localStorage), sem criptografia. Antes de mainnet vamos trocar pra criptografia com senha + recuperação.
        </p>
      </section>

      {/* Saldos */}
      <section className="rounded-2xl border border-app-border bg-neutral-900/70 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-app-text-muted">Saldos</p>
          <button
            onClick={() => refreshBalances(wallet.publicKey)}
            disabled={loading}
            className="text-xs text-violet-300 hover:underline disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <BalanceCard
            label="XLM (gás)"
            value={accountExists ? Number(xlmBalance).toFixed(2) : '—'}
            hint={accountExists ? 'fees on-chain' : 'conta ainda não criada'}
            color="text-cyan-300"
          />
          <BalanceCard
            label={`${TEST_ANCHOR.asset.code} (escrow)`}
            value={srtBalance !== null ? Number(srtBalance).toFixed(2) : '—'}
            hint={srtBalance !== null ? 'pronto pra depósito' : 'sem trustline'}
            color="text-emerald-300"
          />
        </div>

        {!accountExists && (
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/8 p-3 text-xs text-amber-200">
            Conta ainda não existe na testnet. Clique em <strong>"Fundar com Friendbot"</strong> abaixo pra criar + receber 10.000 XLM grátis.
          </div>
        )}
      </section>

      {/* Ações */}
      <section className="rounded-2xl border border-app-border bg-neutral-900/70 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-app-text-muted mb-3">Ações</p>

        <div className="space-y-2">
          <ActionRow
            step="1"
            title="Fundar conta com Friendbot"
            description="Cria a conta na testnet e adiciona 10.000 XLM (gratuito)"
            done={accountExists}
            disabled={accountExists}
            loading={busy === 'friendbot'}
            onClick={handleFriendbot}
          />
          <ActionRow
            step="2"
            title={`Adicionar trustline ${TEST_ANCHOR.asset.code}`}
            description="Autoriza tua conta a receber esse asset (necessário antes do depósito)"
            done={hasTrustline}
            disabled={!accountExists || hasTrustline}
            loading={busy === 'trustline'}
            onClick={handleTrustline}
          />
          <ActionRow
            step="3"
            title={`Depositar ${TEST_ANCHOR.asset.code} via anchor`}
            description="Abre o widget interativo da anchor (SEP-24). Tu confirma o 'pagamento' simulado e o asset cai aqui."
            done={false}
            disabled={!hasTrustline}
            loading={busy === 'deposit'}
            onClick={handleDeposit}
          />
        </div>

        {depositTx && (
          <div className="mt-4 rounded-xl border border-violet-400/24 bg-violet-500/8 p-3 text-xs text-violet-200">
            <div className="font-semibold">Depósito em andamento</div>
            <div className="mt-1 text-app-text-muted">
              ID: <code className="text-violet-300">{depositTx.id.slice(0, 12)}...</code> · Status: <strong>{depositTx.status}</strong>
              {depositTx.amount_in && <> · entrada: {depositTx.amount_in}</>}
            </div>
            {depositTx.stellar_transaction_id && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${depositTx.stellar_transaction_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-violet-300 hover:underline"
              >
                Ver tx Stellar <iconify-icon icon="solar:arrow-right-up-linear" class="text-xs" />
              </a>
            )}
          </div>
        )}
      </section>

      <p className="text-center text-[11px] text-app-text-subtle">
        Anchor: <code>{TEST_ANCHOR.domain}</code> (Stellar Reference Anchor — SDF) · Padrão SEP-10 + SEP-24
      </p>
    </div>
  );
}

function BalanceCard({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div className="rounded-xl border border-app-border bg-white/[0.03] p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-app-text-muted">{label}</p>
      <p className={`mt-2 font-bricolage text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] text-app-text-subtle">{hint}</p>
    </div>
  );
}

function ActionRow({
  step,
  title,
  description,
  done,
  disabled,
  loading,
  onClick,
}: {
  step: string;
  title: string;
  description: string;
  done: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 rounded-xl border p-3 ${
        done ? 'border-emerald-400/24 bg-emerald-500/6' : 'border-app-border bg-white/[0.02]'
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
          done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.04] text-app-text-muted'
        }`}
      >
        {done ? <iconify-icon icon="solar:check-circle-bold" class="text-base" /> : step}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-app-text">{title}</p>
        <p className="text-xs text-app-text-muted">{description}</p>
      </div>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/24 bg-violet-500/12 px-3 py-1.5 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-500/18 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading && <iconify-icon icon="svg-spinners:ring-resize" class="text-sm" />}
        {done ? 'Pronto' : loading ? 'Executando...' : 'Executar'}
      </button>
    </motion.div>
  );
}
