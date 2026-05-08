import { motion } from 'motion/react';
import DOMPurify from 'dompurify';

export default function PrivacyPolicyPage() {
  const lastUpdated = "07 de Maio de 2026";

  const policyHtml = `
    <h2>1. Coleta de Dados Pessoais</h2>
    <p>Nós coletamos apenas as informações estritamente necessárias para a prestação dos serviços de gestão de contratos e assinatura digital, em conformidade com a LGPD (Lei Geral de Proteção de Dados - Lei nº 13.709/2018) e GDPR.</p>
    <ul>
      <li><strong>Dados Cadastrais:</strong> Nome completo, CPF/CNPJ, E-mail, Telefone.</li>
      <li><strong>Dados de Auditoria:</strong> Endereço IP, Geolocalização, Logs de Acesso.</li>
      <li><strong>Dados Financeiros:</strong> Utilizados apenas para o processamento de pagamentos através dos nossos parceiros, nunca armazenando cartões de crédito.</li>
    </ul>

    <h2>2. Base Legal para o Tratamento (Data Processing Agreement - DPA)</h2>
    <p>Todo o processamento de dados realizado em nossa plataforma baseia-se na execução de contrato, cumprimento de obrigação legal ou no consentimento direto do usuário.</p>

    <h2>3. Compartilhamento de Dados</h2>
    <p>Os seus dados pessoais nunca serão vendidos a terceiros. O compartilhamento ocorre exclusivamente com infraestruturas necessárias (AWS, Cloudflare) e autoridades governamentais quando requisitados por ordem judicial (Compliance de Assinatura Eletrônica MP 2.200-2).</p>

    <h2>4. Segurança e Criptografia em Repouso</h2>
    <p>Todos os dados confidenciais e contratos são armazenados de forma criptografada usando AES-256 bits, garantindo o mais alto nível de proteção. Para comunicações em trânsito, utilizamos TLS 1.3 obrigatório em todos os endpoints.</p>

    <h2>5. Seus Direitos (Portal de Direitos do Titular)</h2>
    <p>Você pode acessar o seu <a href="/compliance" class="text-emerald-400">Painel de Compliance</a> a qualquer momento para:</p>
    <ul>
      <li>Revogar o seu consentimento.</li>
      <li>Exigir a portabilidade (exportação) total dos seus dados.</li>
      <li>Solicitar a deleção irrevogável (Right to be Forgotten) da sua conta e de todos os documentos não essenciais por lei.</li>
    </ul>
  `;

  return (
    <div className="max-w-4xl mx-auto py-10 px-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold text-white font-bricolage mb-4">Política de Privacidade</h1>
        <p className="text-neutral-400 mb-8 border-b border-white/10 pb-6">
          Última atualização: {lastUpdated}
        </p>

        {/* We use DOMPurify to guarantee XSS protection on dynamically inserted HTML, satisfying Phase 9 requirements */}
        <div 
          className="prose prose-invert prose-emerald max-w-none prose-headings:font-bricolage prose-headings:font-bold prose-p:text-neutral-300 prose-li:text-neutral-300 prose-a:text-emerald-400"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(policyHtml) }}
        />
      </motion.div>
    </div>
  );
}
