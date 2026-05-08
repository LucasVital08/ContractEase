import { useState } from 'react';
import { motion } from 'motion/react';
import DOMPurify from 'dompurify';

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<'lgpd' | 'security' | 'backups'>('lgpd');

  const sanitizeInput = (html: string) => {
    return DOMPurify.sanitize(html);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-white font-bricolage mb-2">Segurança & Compliance</h1>
        <p className="text-neutral-400">Gerenciamento de Privacidade, Proteção de Dados (LGPD/GDPR) e Estado da Infraestrutura.</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-white/5">
        {[
          { id: 'lgpd', label: 'Privacidade e LGPD' },
          { id: 'security', label: 'Métricas de Segurança (WAF & Headers)' },
          { id: 'backups', label: 'Backups & Disaster Recovery' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'lgpd' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <iconify-icon icon="solar:shield-user-bold" class="text-emerald-500" /> Direitos do Titular
                </h3>
                <p className="text-sm text-neutral-400 mb-6">Em conformidade com a LGPD e GDPR, permitimos a exportação completa de dados ou a exclusão irreversível (Right to be Forgotten).</p>
                <div className="space-y-3">
                  <button className="w-full flex justify-between items-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-sm text-white transition-colors">
                    <span>Exportar Meus Dados (JSON/CSV)</span>
                    <iconify-icon icon="solar:download-square-linear" />
                  </button>
                  <button className="w-full flex justify-between items-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-sm text-white transition-colors">
                    <span>Gerar Relatório DPA (Data Processing Agreement)</span>
                    <iconify-icon icon="solar:document-text-linear" />
                  </button>
                  <button className="w-full flex justify-between items-center bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 transition-colors">
                    <span>Excluir Conta Permanentemente</span>
                    <iconify-icon icon="solar:trash-bin-trash-bold" />
                  </button>
                </div>
              </div>

              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <iconify-icon icon="solar:lock-password-bold" class="text-blue-500" /> Retenção de Dados
                </h3>
                <p className="text-sm text-neutral-400 mb-6">Configure as regras automáticas de arquivamento para documentos inativos (Data Retention Policy).</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-neutral-400 uppercase font-bold block mb-2">Excluir rascunhos inativos após:</label>
                    <select className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none">
                      <option>30 dias</option>
                      <option>60 dias</option>
                      <option>Nunca (Manter para sempre)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 uppercase font-bold block mb-2">Residência dos Dados (Data Residency):</label>
                    <div className="p-3 bg-black/50 border border-white/10 rounded-lg text-sm text-neutral-300 flex items-center justify-between">
                      <span>Brasil (São Paulo) - AWS sa-east-1</span>
                      <iconify-icon icon="solar:check-circle-bold" class="text-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'security' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-6">Status dos Controles de Segurança</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-black/30 border border-emerald-500/20 rounded-xl">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                      <iconify-icon icon="solar:shield-check-bold" /> CSP & Security Headers (Helmet)
                    </h4>
                    <p className="text-xs text-neutral-400 mt-1">Headers X-Frame-Options, XSS Protection e Strict-Transport-Security estão ATIVOS no gateway.</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20 uppercase">Configurado</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-black/30 border border-emerald-500/20 rounded-xl">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                      <iconify-icon icon="solar:shield-check-bold" /> DOMPurify (Prevenção XSS)
                    </h4>
                    <p className="text-xs text-neutral-400 mt-1">Toda a renderização de texto e HTML rico passa por sanitização (DOMPurify).</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20 uppercase">Ativo no Client</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-black/30 border border-emerald-500/20 rounded-xl">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                      <iconify-icon icon="solar:shield-check-bold" /> Criptografia em Repouso (AES-256)
                    </h4>
                    <p className="text-xs text-neutral-400 mt-1">Os documentos armazenados estão encriptados. Key Rotation mensal está automatizada.</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20 uppercase">Configurado</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-black/30 border border-white/5 rounded-xl">
                  <div>
                    <h4 className="text-sm font-bold text-neutral-300 flex items-center gap-2">
                      <iconify-icon icon="solar:shield-warning-bold" class="text-amber-500" /> Web Application Firewall (WAF) & Rate Limit
                    </h4>
                    <p className="text-xs text-neutral-400 mt-1">Regras de limitação de taxa (100 req/min). Defesa Anti-DDoS nível 3/4 via provedor (Cloudflare/AWS).</p>
                  </div>
                  <span className="px-3 py-1 bg-white/5 text-neutral-400 text-[10px] font-bold rounded-full border border-white/10 uppercase">Ativo no Gateway</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'backups' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">Disaster Recovery</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-black/30 border border-emerald-500/20 rounded-xl text-center">
                    <iconify-icon icon="solar:server-square-update-bold" class="text-3xl text-emerald-500 mb-2" />
                    <p className="text-sm font-bold text-white">Replicação Multi-Região</p>
                    <p className="text-xs text-neutral-400 mt-1">Bancos de dados replicados entre sa-east-1 (SP) e us-east-1 (N. Virginia).</p>
                    <p className="text-xs text-emerald-400 mt-2 font-mono">Status: Sincronizado</p>
                  </div>
                  
                  <div className="p-4 bg-black/30 border border-emerald-500/20 rounded-xl text-center">
                    <iconify-icon icon="solar:history-bold" class="text-3xl text-emerald-500 mb-2" />
                    <p className="text-sm font-bold text-white">Point-in-Time Recovery (PITR)</p>
                    <p className="text-xs text-neutral-400 mt-1">Backups incrementais contínuos ativados com janela de recuperação de 35 dias.</p>
                    <p className="text-xs text-emerald-400 mt-2 font-mono">Último snapshot: Há 12 minutos</p>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">Health Check & Uptime</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 border-b border-white/5">
                    <span className="text-sm text-neutral-300">API Gateway</span>
                    <span className="text-sm text-emerald-400 font-mono">99.99%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 border-b border-white/5">
                    <span className="text-sm text-neutral-300">Database Primário</span>
                    <span className="text-sm text-emerald-400 font-mono">99.99%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 border-b border-white/5">
                    <span className="text-sm text-neutral-300">Stellar Node (RPC)</span>
                    <span className="text-sm text-emerald-400 font-mono">100%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 border-b border-white/5">
                    <span className="text-sm text-neutral-300">Storage AWS S3</span>
                    <span className="text-sm text-emerald-400 font-mono">99.99%</span>
                  </div>
                </div>
                
                <button className="w-full mt-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white transition-colors border border-white/10">
                  Ver Relatório de SOC 2 Completo
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
