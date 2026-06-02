import { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore, useNotificationStore } from '@/stores';
import {
  usePartnerConnections,
  useSearchPartners,
  useSendPartnerRequest,
  useAcceptPartnerRequest,
  useRejectPartnerRequest,
  useRemovePartner,
} from '@/hooks/usePartnerQueries';
import type { PartnerConnection, UserSearchResult } from '@/services/partnersService';

export default function PartnersPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const notify = useNotificationStore((s) => s.add);
  const [query, setQuery] = useState('');

  const { data: connections = [] } = usePartnerConnections(user?.id);
  const { data: searchResults = [] } = useSearchPartners(query);
  const sendRequest = useSendPartnerRequest();
  const acceptRequest = useAcceptPartnerRequest();
  const rejectRequest = useRejectPartnerRequest();
  const removePartner = useRemovePartner();

  const accepted = connections.filter((c) => c.status === 'accepted');
  const incoming = connections.filter((c) => c.status === 'pending' && c.partnerId === user?.id);
  const outgoing = connections.filter((c) => c.status === 'pending' && c.initiatorId === user?.id);

  const connectedIds = new Set<string>();
  connections.forEach((c) => {
    if (c.status !== 'rejected') {
      connectedIds.add(c.partnerId);
      connectedIds.add(c.initiatorId);
    }
  });

  const handleSend = async (result: UserSearchResult) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await sendRequest.mutateAsync({
        initiatorId: user.id,
        initiatorName: user.name || user.handle || 'Você',
        initiatorHandle: user.handle || user.id.slice(0, 8),
        initiatorAvatarUrl: user.avatar ?? null,
        partnerId: result.userId,
        partnerName: result.name,
        partnerHandle: result.handle,
        partnerAvatarUrl: result.avatarUrl,
        partnerBio: result.bio,
        partnerJobTitle: result.jobTitle,
      });
      notify({ type: 'success', title: 'Solicitação enviada', message: `${result.name} vai receber o pedido.` });
    } catch (e: any) {
      notify({ type: 'error', title: 'Falha ao enviar', message: e?.message || 'Tente novamente.' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bricolage text-3xl font-bold text-app-text">Parceiros</h1>
        <p className="mt-1 text-sm text-app-text-muted">Sua rede no ContractEase — conecte com pessoas que você quer contratar ou ser contratado.</p>
      </div>

      {/* Solicitações recebidas em destaque */}
      {incoming.length > 0 && (
        <section className="rounded-2xl border border-violet-400/24 bg-violet-500/8 p-5">
          <div className="mb-3 flex items-center gap-2">
            <iconify-icon icon="solar:bell-bold-duotone" class="text-lg text-violet-300" />
            <p className="font-bricolage text-base font-bold text-app-text">
              {incoming.length} solicitação{incoming.length !== 1 ? ' pendentes' : ' pendente'}
            </p>
          </div>
          <div className="space-y-2">
            {incoming.map((c) => (
              <ConnectionRow
                key={c.id}
                conn={c}
                perspective="incoming"
                onAccept={() => acceptRequest.mutate(c.id)}
                onReject={() => rejectRequest.mutate(c.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Busca */}
      <section className="rounded-2xl border border-app-border bg-neutral-900/70 p-5">
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-app-text-muted">Encontrar parceiros</p>
          <h2 className="mt-1 font-bricolage text-base font-bold text-app-text">Busque por @handle, nome ou e-mail</h2>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-app-border bg-black/30 px-4 py-3">
          <iconify-icon icon="solar:magnifer-bold-duotone" class="text-base text-app-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="@gabriel, Maria, contato@empresa.com"
            className="flex-1 bg-transparent text-sm text-app-text outline-none placeholder:text-app-text-subtle"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-app-text-subtle hover:text-app-text">
              <iconify-icon icon="solar:close-circle-linear" class="text-base" />
            </button>
          )}
        </div>

        {query.trim().length >= 2 && (
          <div className="mt-4 space-y-2">
            {searchResults.length === 0 ? (
              <p className="text-xs text-app-text-subtle">Nenhum usuário encontrado. Tente outro termo.</p>
            ) : (
              searchResults.map((r) => {
                const isMe = r.userId === user?.id;
                const isConnected = connectedIds.has(r.userId);
                return (
                  <div key={r.userId} className="flex items-center gap-3 rounded-xl border border-app-border bg-white/[0.04] p-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-app-border bg-gradient-to-br from-violet-500/24 to-cyan-500/20 text-xs font-bold text-app-text">
                      {r.avatarUrl ? <img src={r.avatarUrl} alt={r.name} className="h-full w-full object-cover" /> : (r.name?.charAt(0)?.toUpperCase() || '?')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-app-text">{r.name}</p>
                      <p className="truncate text-xs text-app-text-muted">
                        @{r.handle}
                        {r.jobTitle ? ` · ${r.jobTitle}` : ''}
                        {r.hasWallet ? ' · 🟢 carteira ativa' : ''}
                      </p>
                    </div>
                    {isMe ? (
                      <span className="rounded-full border border-app-border bg-white/[0.03] px-3 py-1 text-[11px] text-app-text-subtle">Você</span>
                    ) : isConnected ? (
                      <span className="rounded-full border border-emerald-400/24 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">Já na rede</span>
                    ) : (
                      <button
                        onClick={() => handleSend(r)}
                        disabled={sendRequest.isPending}
                        className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/24 bg-violet-500/12 px-3 py-1.5 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-500/18 disabled:opacity-50"
                      >
                        <iconify-icon icon="solar:user-plus-bold-duotone" class="text-sm" />
                        Conectar
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Meus parceiros */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-app-text-muted">Sua rede</p>
            <h2 className="mt-1 font-bricolage text-base font-bold text-app-text">
              Meus parceiros{accepted.length > 0 && <span className="ml-2 text-app-text-muted">({accepted.length})</span>}
            </h2>
          </div>
        </div>
        {accepted.length === 0 ? (
          <div className="rounded-2xl border border-app-border bg-white/[0.02] p-10 text-center">
            <iconify-icon icon="solar:users-group-rounded-bold-duotone" class="text-4xl text-app-text-subtle" />
            <p className="mt-3 text-sm text-app-text-muted">Você ainda não tem parceiros conectados.</p>
            <p className="mt-1 text-xs text-app-text-subtle">Busque alguém acima e envie uma solicitação.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {accepted.map((c) => (
              <PartnerCard
                key={c.id}
                conn={c}
                currentUserId={user?.id ?? ''}
                onRemove={() => removePartner.mutate(c.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Solicitações enviadas */}
      {outgoing.length > 0 && (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-app-text-muted">Aguardando resposta</p>
          <div className="space-y-2">
            {outgoing.map((c) => (
              <ConnectionRow key={c.id} conn={c} perspective="outgoing" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ConnectionRow({
  conn,
  perspective,
  onAccept,
  onReject,
}: {
  conn: PartnerConnection;
  perspective: 'incoming' | 'outgoing';
  onAccept?: () => void;
  onReject?: () => void;
}) {
  // No "incoming" o outro lado é o initiator; no "outgoing" é o partner.
  const otherName = perspective === 'incoming' ? conn.initiatorName : conn.partnerName;
  const otherHandle = perspective === 'incoming' ? conn.initiatorHandle : conn.partnerHandle;
  const otherAvatar = perspective === 'incoming' ? conn.initiatorAvatarUrl : conn.partnerAvatarUrl;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-app-border bg-white/[0.04] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-app-border bg-gradient-to-br from-violet-500/24 to-cyan-500/20 text-xs font-bold text-app-text">
        {otherAvatar ? <img src={otherAvatar} alt={otherName} className="h-full w-full object-cover" /> : (otherName?.charAt(0)?.toUpperCase() || '?')}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-app-text">{otherName}</p>
        <p className="truncate text-xs text-app-text-muted">@{otherHandle}</p>
      </div>
      {perspective === 'incoming' ? (
        <div className="flex items-center gap-1.5">
          <button onClick={onAccept} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/24 bg-emerald-500/12 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/18">
            <iconify-icon icon="solar:check-circle-bold" class="text-sm" />
            Aceitar
          </button>
          <button onClick={onReject} className="inline-flex items-center gap-1 rounded-full border border-app-border bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-app-text-muted transition-colors hover:text-app-text">
            <iconify-icon icon="solar:close-circle-linear" class="text-sm" />
            Recusar
          </button>
        </div>
      ) : (
        <span className="rounded-full border border-amber-400/24 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-300">Aguardando</span>
      )}
    </div>
  );
}

function PartnerCard({
  conn,
  currentUserId,
  onRemove,
}: {
  conn: PartnerConnection;
  currentUserId: string;
  onRemove: () => void;
}) {
  // Mostra sempre o "outro lado" do connection, do ponto de vista do usuário atual.
  const isInitiator = conn.initiatorId === currentUserId;
  const otherName = isInitiator ? conn.partnerName : conn.initiatorName;
  const otherHandle = isInitiator ? conn.partnerHandle : conn.initiatorHandle;
  const otherAvatar = isInitiator ? conn.partnerAvatarUrl : conn.initiatorAvatarUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-app-border bg-neutral-900/70 p-4"
    >
      <div className="flex items-start gap-3">
        <Link
          to={`/@${otherHandle}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-app-border bg-gradient-to-br from-violet-500/24 to-cyan-500/20 text-sm font-bold text-app-text"
        >
          {otherAvatar ? <img src={otherAvatar} alt={otherName} className="h-full w-full object-cover" /> : (otherName?.charAt(0)?.toUpperCase() || '?')}
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/@${otherHandle}`} className="block truncate font-bricolage text-sm font-bold text-app-text hover:underline">{otherName}</Link>
          <p className="truncate text-[11px] text-violet-300">@{otherHandle}</p>
          {conn.partnerJobTitle && isInitiator && <p className="mt-0.5 truncate text-[11px] text-app-text-muted">{conn.partnerJobTitle}</p>}
        </div>
      </div>
      {conn.partnerBio && isInitiator && (
        <p className="mt-3 line-clamp-3 text-xs leading-5 text-app-text-muted">{conn.partnerBio}</p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-app-border pt-3">
        <Link to={`/@${otherHandle}`} className="text-[11px] font-semibold text-violet-300 hover:underline">Ver perfil</Link>
        <button
          onClick={onRemove}
          title="Remover parceiro"
          className="rounded-lg p-1.5 text-app-text-subtle transition-colors hover:bg-white/[0.05] hover:text-app-text"
        >
          <iconify-icon icon="solar:user-minus-rounded-bold-duotone" class="text-sm" />
        </button>
      </div>
    </motion.div>
  );
}
