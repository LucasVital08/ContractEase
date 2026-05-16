import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore, useNotificationStore } from '@/stores';
import { supabase } from '@/lib/supabase';

type ApiKey = { id: string; name: string; key_prefix: string; last_used_at: string | null; created_at: string };
type Webhook = { id: string; name: string; url: string; events: string[]; active: boolean; last_triggered_at: string | null; failure_count: number; created_at: string };
type Delivery = { id: string; webhook_id: string; event: string; response_status: number | null; success: boolean; delivered_at: string };

const ALL_EVENTS = [
  { value: 'contract.created', label: 'Contrato criado' },
  { value: 'contract.signed', label: 'Parte assinou' },
  { value: 'contract.completed', label: 'Todos assinaram' },
  { value: 'contract.anchored', label: 'Ancorado na Stellar' },
  { value: 'contract.cancelled', label: 'Contrato cancelado' },
];

const COMING_SOON = [
  { id: 'zapier', name: 'Zapier', icon: 'logos:zapier', desc: 'Dispare automações em mais de 5.000 apps.' },
  { id: 'slack', name: 'Slack', icon: 'devicon:slack', desc: 'Notificações de assinaturas em canais do Slack.' },
  { id: 'gdrive', name: 'Google Drive', icon: 'logos:google-drive', desc: 'Backup automático de PDFs assinados.' },
  { id: 'gdocs', name: 'Google Docs', icon: 'vscode-icons:file-type-gdocs', desc: 'Redija cláusulas direto no Google Docs.' },
];

export default function IntegrationsPage() {
  const user = useAuthStore(s => s.user);
  const notify = useNotificationStore(s => s.add);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ key: string; name: string } | null>(null);

  // Webhooks
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [whLoading, setWhLoading] = useState(true);
  const [showWhForm, setShowWhForm] = useState(false);
  const [whForm, setWhForm] = useState({ name: '', url: '', events: ['contract.completed', 'contract.signed'] });
  const [savingWh, setSavingWh] = useState(false);
  const [selectedWh, setSelectedWh] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => { loadKeys(); loadWebhooks(); }, []);

  async function loadKeys() {
    setKeysLoading(true);
    const { data, error } = await supabase.functions.invoke('manage-api-key', { body: { action: 'list' } });
    if (!error) setApiKeys(data?.data || []);
    setKeysLoading(false);
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    const { data, error } = await supabase.functions.invoke('manage-api-key', { body: { action: 'create', name: newKeyName } });
    if (error || !data?.success) {
      notify({ type: 'error', title: 'Erro ao criar chave', message: error?.message || data?.error });
    } else {
      setRevealedKey({ key: data.key, name: newKeyName });
      setNewKeyName('');
      loadKeys();
    }
    setCreatingKey(false);
  }

  async function revokeKey(keyId: string, keyName: string) {
    const { data, error } = await supabase.functions.invoke('manage-api-key', { body: { action: 'revoke', keyId } });
    if (error || !data?.success) {
      notify({ type: 'error', title: 'Erro ao revogar chave' });
    } else {
      notify({ type: 'success', title: `Chave "${keyName}" revogada` });
      loadKeys();
    }
  }

  async function loadWebhooks() {
    setWhLoading(true);
    const { data } = await supabase.from('webhooks').select('*').order('created_at', { ascending: false });
    setWebhooks(data || []);
    setWhLoading(false);
  }

  async function saveWebhook() {
    if (!whForm.name || !whForm.url || whForm.events.length === 0) return;
    setSavingWh(true);
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
    const { error } = await supabase.from('webhooks').insert({
      name: whForm.name, url: whForm.url, events: whForm.events, secret,
    });
    if (error) {
      notify({ type: 'error', title: 'Erro ao criar webhook', message: error.message });
    } else {
      notify({ type: 'success', title: 'Webhook criado!' });
      setShowWhForm(false);
      setWhForm({ name: '', url: '', events: ['contract.completed', 'contract.signed'] });
      loadWebhooks();
    }
    setSavingWh(false);
  }

  async function toggleWebhook(wh: Webhook) {
    await supabase.from('webhooks').update({ active: !wh.active }).eq('id', wh.id);
    loadWebhooks();
  }

  async function deleteWebhook(id: string) {
    await supabase.from('webhooks').delete().eq('id', id);
    if (selectedWh === id) setSelectedWh(null);
    loadWebhooks();
  }

  async function loadDeliveries(webhookId: string) {
    setSelectedWh(webhookId);
    const { data } = await supabase.from('webhook_deliveries').select('*').eq('webhook_id', webhookId).order('delivered_at', { ascending: false }).limit(20);
    setDeliveries(data || []);
  }

  function toggleEvent(ev: string) {
    setWhForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }));
  }

  const widgetSnippet = `<script src="https://cdn.contractease.com/widget.js"></script>\n<ce-sign contract-id="SEU_CONTRACT_ID" theme="dark"></ce-sign>`;

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <header>
        <h1 className="text-3xl font-bold text-white font-bricolage mb-2">Integrações & API</h1>
        <p className="text-neutral-400">Conecte o ContractEase ao seu ecossistema de ferramentas.</p>
      </header>

      {/* ── API Keys ─────────────────────────────────────────── */}
      <section className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <iconify-icon icon="solar:key-bold-duotone" class="text-xl text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white font-bricolage">Chaves de API</h2>
            <p className="text-xs text-neutral-500">Use para autenticar integrações externas via header <code className="bg-black/30 px-1 rounded">Authorization: Bearer sk_ce_...</code></p>
          </div>
        </div>

        {/* Criar nova chave */}
        <div className="flex gap-3">
          <input
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createKey()}
            placeholder="Nome da chave (ex: Zapier Produção)"
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-neutral-600"
          />
          <button type="button" onClick={createKey} disabled={creatingKey || !newKeyName.trim()}
            className="px-5 py-2.5 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors text-sm disabled:opacity-50 flex items-center gap-2">
            {creatingKey ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <iconify-icon icon="solar:add-circle-bold" />}
            Gerar
          </button>
        </div>

        {/* Modal chave revelada */}
        <AnimatePresence>
          {revealedKey && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
              <div className="flex items-start gap-2">
                <iconify-icon icon="solar:danger-triangle-bold" class="text-amber-400 text-lg flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 font-medium">Copie agora — esta chave não será exibida novamente após fechar.</p>
              </div>
              <div className="flex items-center gap-2 bg-black/50 rounded-lg px-3 py-2">
                <code className="text-emerald-400 font-mono text-xs flex-1 break-all">{revealedKey.key}</code>
                <button type="button" aria-label="Copiar chave" onClick={() => { navigator.clipboard.writeText(revealedKey.key); notify({ type: 'success', title: 'Chave copiada!' }); }}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors flex-shrink-0">
                  <iconify-icon icon="solar:copy-bold" />
                </button>
              </div>
              <button type="button" onClick={() => setRevealedKey(null)} className="text-xs text-neutral-500 hover:text-white transition-colors">
                Entendi, já copiei a chave
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista de chaves */}
        {keysLoading ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 bg-white/[0.03] rounded-xl animate-pulse" />)}</div>
        ) : apiKeys.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-4">Nenhuma chave criada ainda.</p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map(key => (
              <div key={key.id} className="flex items-center justify-between p-4 bg-black/30 border border-white/5 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-white">{key.name}</p>
                  <p className="text-xs text-neutral-500 font-mono">{key.key_prefix}•••••••••••••••</p>
                  {key.last_used_at && <p className="text-[10px] text-neutral-600 mt-0.5">Último uso: {new Date(key.last_used_at).toLocaleDateString('pt-BR')}</p>}
                </div>
                <button type="button" onClick={() => revokeKey(key.id, key.name)}
                  className="px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-lg transition-all border border-red-500/20">
                  Revogar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Webhooks ─────────────────────────────────────────── */}
      <section className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <iconify-icon icon="solar:bell-bing-bold-duotone" class="text-xl text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-bricolage">Webhooks</h2>
              <p className="text-xs text-neutral-500">Receba notificações HTTP quando eventos ocorrem nos seus contratos</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowWhForm(v => !v)}
            className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold rounded-xl hover:bg-blue-500/20 transition-colors text-sm flex items-center gap-2">
            <iconify-icon icon="solar:add-circle-bold" /> Novo Webhook
          </button>
        </div>

        {/* Formulário de criação */}
        <AnimatePresence>
          {showWhForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-black/30 border border-white/5 rounded-xl p-5 space-y-4 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">Nome</label>
                  <input value={whForm.name} onChange={e => setWhForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Notificar CRM" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder:text-neutral-600" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">URL do Endpoint</label>
                  <input value={whForm.url} onChange={e => setWhForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="https://seu-app.com/webhook" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder:text-neutral-600" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-2">Eventos</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_EVENTS.map(ev => (
                    <button key={ev.value} type="button" onClick={() => toggleEvent(ev.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        whForm.events.includes(ev.value) ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/[0.03] border-white/10 text-neutral-500 hover:text-white'
                      }`}>
                      {ev.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-neutral-500">Um segredo HMAC-SHA256 será gerado automaticamente para validar os payloads.</p>
              <div className="flex gap-3">
                <button type="button" onClick={saveWebhook} disabled={savingWh || !whForm.name || !whForm.url || whForm.events.length === 0}
                  className="px-5 py-2.5 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-400 transition-colors text-sm disabled:opacity-50 flex items-center gap-2">
                  {savingWh ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  Criar Webhook
                </button>
                <button type="button" onClick={() => setShowWhForm(false)} className="px-5 py-2.5 bg-white/5 text-neutral-300 font-medium rounded-xl hover:bg-white/10 transition-colors text-sm">Cancelar</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista de webhooks */}
        {whLoading ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />)}</div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <iconify-icon icon="solar:bell-off-bold-duotone" class="text-3xl mb-2 block" />
            <p className="text-sm">Nenhum webhook configurado ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {webhooks.map(wh => (
              <div key={wh.id} className="border border-white/5 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-black/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wh.active ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">{wh.name}</p>
                      <p className="text-xs text-neutral-500 font-mono truncate">{wh.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {wh.failure_count > 0 && (
                      <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">{wh.failure_count} falhas</span>
                    )}
                    <button type="button" aria-label="Ver histórico de entregas" onClick={() => selectedWh === wh.id ? setSelectedWh(null) : loadDeliveries(wh.id)}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-500 hover:text-white transition-colors text-xs">
                      <iconify-icon icon="solar:history-bold" />
                    </button>
                    <button type="button" aria-label={wh.active ? 'Desativar webhook' : 'Ativar webhook'} onClick={() => toggleWebhook(wh)}
                      className={`p-1.5 rounded-lg transition-colors text-xs ${wh.active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-neutral-500 hover:bg-white/10'}`}>
                      <iconify-icon icon={wh.active ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} />
                    </button>
                    <button type="button" aria-label="Excluir webhook" onClick={() => deleteWebhook(wh.id)}
                      className="p-1.5 hover:bg-red-500/10 rounded-lg text-neutral-600 hover:text-red-400 transition-colors text-xs">
                      <iconify-icon icon="solar:trash-bin-bold" />
                    </button>
                  </div>
                </div>
                <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
                  {wh.events.map(ev => <span key={ev} className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{ev}</span>)}
                </div>
                {/* Delivery log */}
                <AnimatePresence>
                  {selectedWh === wh.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 bg-black/30 overflow-hidden">
                      <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto">
                        <p className="text-[10px] text-neutral-500 uppercase font-bold mb-2">Últimas entregas</p>
                        {deliveries.length === 0
                          ? <p className="text-xs text-neutral-600">Nenhuma entrega registrada ainda.</p>
                          : deliveries.map(d => (
                            <div key={d.id} className="flex items-center gap-2 text-xs">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              <span className="text-neutral-400 font-mono">{d.event}</span>
                              <span className={`${d.success ? 'text-emerald-400' : 'text-red-400'}`}>HTTP {d.response_status || '—'}</span>
                              <span className="text-neutral-600 ml-auto">{new Date(d.delivered_at).toLocaleTimeString('pt-BR')}</span>
                            </div>
                          ))
                        }
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {/* Documentação de payload */}
        <div className="bg-black/30 border border-white/5 rounded-xl p-4">
          <p className="text-xs font-bold text-neutral-400 mb-2">Formato do payload enviado:</p>
          <pre className="text-[10px] text-emerald-400 font-mono overflow-x-auto">{`{
  "event": "contract.completed",
  "timestamp": "2026-05-16T14:30:00Z",
  "contract_id": "uuid",
  "data": { ...dados do contrato }
}`}</pre>
          <p className="text-[10px] text-neutral-500 mt-2">Valide com o header <code className="bg-black/30 px-1 rounded">X-ContractEase-Signature: sha256=HMAC</code></p>
        </div>
      </section>

      {/* ── Widget de Assinatura ──────────────────────────────── */}
      <section className="bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-violet-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-violet-500/10 rounded-lg">
            <iconify-icon icon="solar:code-bold-duotone" class="text-xl text-violet-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white font-bricolage">Widget de Assinatura</h3>
            <p className="text-xs text-neutral-400">Embed em qualquer site ou landing page</p>
          </div>
        </div>
        <div className="bg-black/50 rounded-xl p-4 border border-white/10 mb-4 overflow-x-auto">
          <pre className="text-[10px] text-fuchsia-400 font-mono whitespace-pre">{widgetSnippet}</pre>
        </div>
        <button type="button" onClick={() => { navigator.clipboard.writeText(widgetSnippet); notify({ type: 'success', title: 'Snippet copiado!' }); }}
          className="px-6 py-2 bg-violet-500 text-white font-bold rounded-xl hover:bg-violet-400 transition-all text-xs flex items-center gap-2">
          <iconify-icon icon="solar:copy-bold" /> Copiar Snippet
        </button>
      </section>

      {/* ── Integrações Em Breve ──────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Integrações Nativas — Em Breve</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COMING_SOON.map(int => (
            <motion.div key={int.id} whileHover={{ y: -3 }}
              className="bg-neutral-900/50 border border-white/5 rounded-2xl p-5 flex flex-col opacity-60">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center p-2 mb-3">
                <iconify-icon icon={int.icon} class="text-2xl" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{int.name}</h3>
              <p className="text-xs text-neutral-500 flex-1">{int.desc}</p>
              <span className="mt-3 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Em breve</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
