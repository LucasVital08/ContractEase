import { useState } from 'react';
import { motion } from 'motion/react';
import { useNotificationStore } from '@/stores';

const INTEGRATIONS = [
  { id: 'zapier', name: 'Zapier', icon: 'logos:zapier', desc: 'Dispare automações em mais de 5.000 apps.', status: 'connected' },
  { id: 'slack', name: 'Slack', icon: 'devicon:slack', desc: 'Receba notificações de assinaturas em canais.', status: 'pending' },
  { id: 'gdrive', name: 'Google Drive', icon: 'logos:google-drive', desc: 'Backup automático de todos os PDFs assinados.', status: 'pending' },
  { id: 'whatsapp', name: 'WhatsApp Bot', icon: 'logos:whatsapp-icon', desc: 'Consulte status via comandos no Zap.', status: 'connected' },
  { id: 'gdocs', name: 'Google Docs', icon: 'vscode-icons:file-type-gdocs', desc: 'Extensão para redigir cláusulas direto no editor.', status: 'available' },
];

export default function IntegrationsPage() {
  const notify = useNotificationStore(s => s.add);
  // Lazy initializer ensures the key is generated once per mount, not on every render.
  // TODO: replace with a real API key fetched from the backend (profiles.settings or a dedicated api_keys table).
  const [apiKey, setApiKey] = useState(() => 'sk_stellar_' + Math.random().toString(36).substring(7).toUpperCase());

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <header>
        <h1 className="text-3xl font-bold text-white font-bricolage mb-2">Integrações & API</h1>
        <p className="text-neutral-400">Conecte o ContractEase ao seu ecossistema de ferramentas.</p>
      </header>

      {/* API Key Section */}
      <section className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <iconify-icon icon="solar:key-bold" class="text-xl text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white font-bricolage">API para Desenvolvedores</h2>
        </div>
        
        <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold mb-1">Sua Chave de API (Secret Key)</p>
            <code className="text-emerald-400 font-mono text-sm">{apiKey}</code>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(apiKey);
                notify({ type: 'success', title: 'Copiado!', message: 'Chave de API copiada para a área de transferência.' });
              }}
              className="p-2 hover:bg-white/5 rounded-lg text-neutral-400 hover:text-white transition-colors"
            >
              <iconify-icon icon="solar:copy-bold" />
            </button>
            <button 
              onClick={() => setApiKey('sk_stellar_' + Math.random().toString(36).substring(7).toUpperCase())}
              className="p-2 hover:bg-white/5 rounded-lg text-neutral-400 hover:text-white transition-colors"
            >
              <iconify-icon icon="solar:refresh-bold" />
            </button>
          </div>
        </div>
        <a href="#" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
          <iconify-icon icon="solar:document-bold" /> Acessar Documentação Swagger (v1.0)
        </a>
      </section>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {INTEGRATIONS.map((int) => (
          <motion.div 
            key={int.id}
            whileHover={{ y: -5 }}
            className="bg-neutral-900 border border-white/5 rounded-2xl p-6 flex flex-col group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center p-2">
                <iconify-icon icon={int.icon} class="text-3xl" />
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                int.status === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                int.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                'bg-white/5 text-neutral-500 border border-white/10'
              }`}>
                {int.status === 'connected' ? 'Ativo' : int.status === 'pending' ? 'Pendente' : 'Disponível'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white font-bricolage mb-1">{int.name}</h3>
            <p className="text-xs text-neutral-400 mb-6 flex-1">{int.desc}</p>
            <button className="w-full py-2 bg-white/5 text-neutral-300 rounded-xl text-xs font-bold hover:bg-white/10 transition-all border border-white/10 group-hover:border-white/20">
              {int.status === 'connected' ? 'Gerenciar' : 'Conectar Agora'}
            </button>
          </motion.div>
        ))}

        {/* Embedded Widget Tool */}
        <div className="bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-violet-500/20 rounded-2xl p-6 flex flex-col col-span-1 md:col-span-2">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <iconify-icon icon="solar:code-bold" class="text-xl text-violet-400" />
              </div>
              <h3 className="text-xl font-bold text-white font-bricolage">Widget de Assinatura</h3>
           </div>
           <p className="text-sm text-neutral-300 mb-6">Crie um botão "Assinar Agora" para colocar em sua Landing Page ou Site Institucional.</p>
           <div className="bg-black/50 rounded-xl p-4 border border-white/10 mb-4 overflow-x-auto">
             <code className="text-[10px] text-fuchsia-400 font-mono">
               &lt;script src="https://cdn.contractease.com/widget.js"&gt;&lt;/script&gt;<br/>
               &lt;ce-sign contract-id="YOUR_ID" theme="dark"&gt;&lt;/ce-sign&gt;
             </code>
           </div>
           <button className="self-start px-6 py-2 bg-violet-500 text-white font-bold rounded-xl hover:bg-violet-400 transition-all text-xs">
             Copiar Snippet
           </button>
        </div>
      </div>
    </div>
  );
}
