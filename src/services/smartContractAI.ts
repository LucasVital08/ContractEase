/**
 * Smart Contract AI Service
 *
 * Camada de IA para o ContractEase. Por enquanto rodando 100% local com
 * lógica determinística (mock), mas a interface foi desenhada para ser
 * substituída pela Claude API sem mudar nenhuma chamada do front.
 *
 * Quando plugar a Claude API:
 *   1. Crie src/services/anthropicClient.ts com fetch para /messages
 *   2. Troque o corpo de cada função abaixo por uma chamada ao client
 *   3. Mantenha as mesmas assinaturas — front continua funcionando
 */

import type { SmartContractTemplate, SCVariable } from './smartContractTemplates';
import { resolveHandleSync, extractHandlesFromText } from './handleResolver';

// ─── Tipos ───────────────────────────────────────────────────────────

export interface AIChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  extractedFields?: Record<string, string>;
}

export interface AIExtractResult {
  fields: Record<string, string>;
  unmatched: string[];
  confidence: number;
  followUpQuestion?: string;
}

export interface AIExplainResult {
  summary: string;
  bulletPoints: string[];
  risks: { level: 'low' | 'medium' | 'high'; text: string }[];
  whatHappensIf: { scenario: string; outcome: string }[];
}

// ─── Helpers de parsing ──────────────────────────────────────────────

/**
 * Extrai um endereço Stellar (G...) da mensagem
 */
function extractStellarAddress(text: string): string | null {
  const match = text.match(/G[A-Z2-7]{55}/);
  return match ? match[0] : null;
}

/**
 * Extrai um valor numérico (com formatos R$ 1.000, 1000.50, 1k, 1mil etc)
 */
function extractAmount(text: string): string | null {
  // Aceita: 1000, 1.000, 1,000.50, 1k, 1mil, 1000.50
  const cleaned = text.replace(/r\$/gi, '').replace(/\s+/g, ' ');

  // Padrão "1k", "10k", "2.5k" - shortcuts comuns
  const kMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*k(?!\w)/i);
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(',', '.'));
    return String(num * 1000);
  }

  // "1mil", "10 mil"
  const milMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*mil(?!\w)/i);
  if (milMatch) {
    const num = parseFloat(milMatch[1].replace(',', '.'));
    return String(num * 1000);
  }

  // Padrão geral de número (preferindo precedido por "valor", "R$", "amount")
  const numMatch = cleaned.match(/(?:valor|amount|montante|preço|r\$|usdc|xlm|brz)?\s*([\d.,]+)/i);
  if (numMatch) {
    // Normaliza: remove pontos de milhar, troca vírgula decimal por ponto
    let n = numMatch[1];
    if (n.includes(',') && n.includes('.')) {
      n = n.replace(/\./g, '').replace(',', '.');
    } else if (n.includes(',')) {
      n = n.replace(',', '.');
    }
    const parsed = parseFloat(n);
    if (!isNaN(parsed) && parsed > 0) return String(parsed);
  }

  return null;
}

/**
 * Detecta menção a moeda
 */
function extractAsset(text: string): string | null {
  if (/\busdc\b/i.test(text)) return 'USDC';
  if (/\bbrz\b/i.test(text)) return 'BRZ';
  if (/\bxlm\b|\blumens?\b/i.test(text)) return 'XLM';
  if (/\breal\b|\bbrl\b|\br\$\b/i.test(text)) return 'BRZ';
  if (/\bdólares?\b|\busd\b/i.test(text)) return 'USDC';
  return null;
}

/**
 * Extrai uma data no formato ISO (yyyy-mm-dd) de texto livre
 */
function extractDate(text: string): string | null {
  // dd/mm/yyyy
  const brMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // "em 30 dias", "em 6 meses"
  const relMatch = text.match(/em\s+(\d+)\s+(dias?|semanas?|meses|anos?)/i);
  if (relMatch) {
    const [, n, unit] = relMatch;
    const date = new Date();
    const num = parseInt(n);
    if (/dia/i.test(unit)) date.setDate(date.getDate() + num);
    else if (/semana/i.test(unit)) date.setDate(date.getDate() + num * 7);
    else if (/m[eê]s/i.test(unit)) date.setMonth(date.getMonth() + num);
    else if (/ano/i.test(unit)) date.setFullYear(date.getFullYear() + num);
    return date.toISOString().split('T')[0];
  }
  return null;
}

/**
 * Detecta papéis (comprador, vendedor etc) próximos a endereços
 */
// Tipo de identificador que extraímos junto com o papel:
// - 'address' = G... colado direto
// - 'handle'  = @username resolvido para um endereço
type RoleSource = { address: string; via: 'address' | 'handle'; handle?: string };

const ROLE_PATTERNS: { roles: string[]; regex: RegExp }[] = [
  // Imóveis (rent)
  { roles: ['landlord'], regex: /locador|propriet[áa]rio|landlord/i },
  { roles: ['tenant'],   regex: /locat[áa]rio|inquilino|tenant/i },
  // E-commerce
  { roles: ['buyer'],    regex: /comprador|buyer/i },
  { roles: ['seller'],   regex: /vendedor|seller|lojista/i },
  // Freelancer / Cliente
  { roles: ['client'],     regex: /cliente|contratante|client(?!e\s+final)/i },
  { roles: ['freelancer'], regex: /freelancer|freela|prestador|contratado/i },
  // Folha
  { roles: ['company'],  regex: /empresa|company|empregador|employer/i },
  // Factoring
  { roles: ['issuer'],   regex: /emissor|cedente|pme/i },
  { roles: ['investor'], regex: /investidor|cession[áa]rio|investor/i },
  { roles: ['debtor'],   regex: /sacado|cliente\s+final|devedor|debtor/i },
  // Vesting
  { roles: ['beneficiary'], regex: /cofundador|founder|funcion[áa]rio|benefici[áa]rio|beneficiary/i },
  // Seguro
  { roles: ['insurer'], regex: /segurador(a)?|insurer|seguradora/i },
  { roles: ['insured'], regex: /segurado(?!r)|insured/i },
  { roles: ['oracle'],  regex: /or[áa]culo|oracle/i },
  // Genéricos
  { roles: ['arbiter'], regex: /[áa]rbitro|arbiter|juiz/i },
  { roles: ['creator'], regex: /criador|creator|organizador/i },
];

function extractRoles(text: string): Record<string, RoleSource> {
  const result: Record<string, RoleSource> = {};

  // Quebra o texto em "trechos" — uma sentença/clausula por vez
  const chunks = text.split(/[,;\n]| e |\.| pra | para /);

  for (const chunk of chunks) {
    // Procura identificador (handle tem preferência por ser mais user-friendly)
    let identifier: { address: string; via: 'address' | 'handle'; handle?: string } | null = null;

    const handleMatch = chunk.match(/@([a-z][a-z0-9_]{1,30})/i);
    if (handleMatch) {
      const resolved = resolveHandleSync(handleMatch[1]);
      if (resolved) {
        identifier = { address: resolved.address, via: 'handle', handle: handleMatch[1].toLowerCase() };
      }
    }

    if (!identifier) {
      const addr = extractStellarAddress(chunk);
      if (addr) identifier = { address: addr, via: 'address' };
    }

    if (!identifier) continue;

    // Aplica o identificador ao primeiro papel detectado no trecho
    for (const pattern of ROLE_PATTERNS) {
      if (pattern.regex.test(chunk)) {
        for (const role of pattern.roles) {
          if (!result[role]) result[role] = identifier;
        }
      }
    }
  }

  return result;
}

// ─── API pública ─────────────────────────────────────────────────────

/**
 * Extrai campos de uma mensagem em linguagem natural baseado nas variáveis do template.
 * Substitua o corpo desta função por uma chamada à Claude API quando plugar.
 */
export async function extractFieldsFromMessage(
  template: SmartContractTemplate,
  message: string,
  alreadyFilled: Record<string, string> = {}
): Promise<AIExtractResult> {
  // Latência simulada — sensação de "pensando"
  await new Promise(r => setTimeout(r, 600 + Math.random() * 400));

  const extracted: Record<string, string> = {};
  const unmatched: string[] = [];

  const roles = extractRoles(message);

  for (const variable of template.variables) {
    if (alreadyFilled[variable.name]) continue;

    let value: string | null = null;

    if (variable.type === 'address') {
      // Tenta papel específico primeiro
      const roleSource = roles[variable.name];
      if (roleSource) {
        // Salva o @handle quando vier por handle (UI mostra com clareza),
        // ou o endereço bruto se foi colado direto
        value = roleSource.via === 'handle' && roleSource.handle
          ? `@${roleSource.handle}`
          : roleSource.address;
      }
      // Fallbacks quando só tem 1 campo de endereço no template
      if (!value && template.variables.filter(v => v.type === 'address').length === 1) {
        // Tenta achar um @handle solto na mensagem
        const handles = extractHandlesFromText(message);
        for (const h of handles) {
          if (resolveHandleSync(h)) { value = `@${h}`; break; }
        }
        // Senão, endereço G... solto
        if (!value) value = extractStellarAddress(message);
      }
    } else if (variable.type === 'amount') {
      // Tentativa específica por palavra-chave próxima ao número
      if (variable.name === 'monthlyRent') {
        const m = message.match(/aluguel[^\d]*([\d.,]+)|([\d.,]+)\s*(?:de\s+)?aluguel/i);
        if (m) value = extractAmount(m[0]);
      }
      if (!value && variable.name === 'faceValue') {
        const m = message.match(/(?:face|nf|valor\s+da\s+nf|nota\s+fiscal)[^\d]*([\d.,]+)/i);
        if (m) value = extractAmount(m[0]);
      }
      if (!value && variable.name === 'unitPrice') {
        const m = message.match(/(?:por\s+pessoa|cada|unit[áa]rio)[^\d]*([\d.,]+)|([\d.,]+)\s*(?:por|cada)/i);
        if (m) value = extractAmount(m[0]);
      }
      if (!value && variable.name === 'premium') {
        const m = message.match(/(?:pr[êe]mio)[^\d]*([\d.,]+)/i);
        if (m) value = extractAmount(m[0]);
      }
      if (!value && variable.name === 'payout') {
        const m = message.match(/(?:indeniza[çc][ãa]o|payout)[^\d]*([\d.,]+)/i);
        if (m) value = extractAmount(m[0]);
      }
      // Fallback genérico — pega o primeiro número se o template só tem um campo amount
      if (!value) {
        const amountFields = template.variables.filter(v => v.type === 'amount');
        if (amountFields.length === 1 && amountFields[0].name === variable.name) {
          value = extractAmount(message);
        }
      }
    } else if (variable.type === 'asset') {
      value = extractAsset(message);
    } else if (variable.type === 'date') {
      value = extractDate(message);
    } else if (variable.type === 'number') {
      // Procura número próximo a palavra-chave da variável
      const labelWords = variable.label.toLowerCase().split(/\s+/);
      for (const word of labelWords) {
        if (word.length < 3) continue;
        const re = new RegExp(`${word}[^\\d]*([\\d]+)`, 'i');
        const m = message.match(re);
        if (m) { value = m[1]; break; }
      }
      // Fallbacks específicos
      if (!value && variable.name === 'cliffMonths') {
        const m = message.match(/cliff\s+(?:de\s+)?(\d+)/i);
        if (m) value = m[1];
      }
      if (!value && variable.name === 'vestingMonths') {
        const m = message.match(/(\d+)\s*meses?\s*(?:de\s+)?vesting|vesting\s+(?:de\s+)?(\d+)|(\d+)\s*anos?\s*(?:de\s+)?vesting/i);
        if (m) {
          if (m[3]) value = String(parseInt(m[3]) * 12); // anos → meses
          else value = m[1] || m[2];
        }
      }
      if (!value && variable.name === 'milestoneCount') {
        const m = message.match(/(\d+)\s*(?:etapas?|milestones?|entregas?|fases?)/i);
        if (m) value = m[1];
      }
      if (!value && variable.name === 'depositMonths') {
        const m = message.match(/(\d+)\s*(?:meses?\s+(?:de\s+)?)?cau[çc][ãa]o|cau[çc][ãa]o\s+(?:de\s+)?(\d+)/i);
        if (m) value = m[1] || m[2];
      }
      if (!value && variable.name === 'dueDay') {
        const m = message.match(/(?:vencimento|vence|dia)\s+(?:em\s+)?(\d{1,2})|(?:todo\s+)?dia\s+(\d{1,2})/i);
        if (m) value = m[1] || m[2];
      }
      if (!value && variable.name === 'durationMonths') {
        const m = message.match(/dura[çc][ãa]o\s+(?:de\s+)?(\d+)\s*meses?|contrato\s+(?:de\s+)?(\d+)\s*meses?/i);
        if (m) value = m[1] || m[2];
      }
      if (!value && variable.name === 'minParticipants') {
        const m = message.match(/(\d+)\s*(?:pessoas?|participantes?)/i);
        if (m) value = m[1];
      }
      if (!value && variable.name === 'payDay') {
        const m = message.match(/(?:pagamento|sal[áa]rio)[^\d]*dia\s+(\d{1,2})/i);
        if (m) value = m[1];
      }
      if (!value && variable.name === 'autoReleaseDays' || variable.name === 'reviewDays') {
        const m = message.match(/(\d+)\s*dias?/i);
        if (m) value = m[1];
      }
      if (!value && (variable.name === 'annualRate' || variable.name === 'discountPct')) {
        const m = message.match(/(\d+(?:[.,]\d+)?)\s*%/);
        if (m) value = m[1].replace(',', '.');
      }
      if (!value && variable.name === 'termMonths') {
        const m = message.match(/(\d+)\s*meses?\s*(?:de\s+)?prazo|prazo\s+(?:de\s+)?(\d+)\s*meses?|(\d+)\s*anos?/i);
        if (m) {
          if (m[3]) value = String(parseInt(m[3]) * 12);
          else value = m[1] || m[2];
        }
      }
    } else if (variable.type === 'duration') {
      const m = message.match(/(\d+)\s*(dias?|semanas?|meses|anos?)/i);
      if (m) value = `${m[1]} ${m[2]}`;
    } else if (variable.type === 'select') {
      if (variable.name === 'frequency') {
        if (/di[áa]ri/i.test(message)) value = 'Diário';
        else if (/semanal/i.test(message)) value = 'Semanal';
        else if (/mensal/i.test(message)) value = 'Mensal';
        else if (/anual/i.test(message)) value = 'Anual';
      } else if (variable.options) {
        for (const opt of variable.options) {
          if (new RegExp(`\\b${opt}\\b`, 'i').test(message)) { value = opt; break; }
        }
      }
    } else if (variable.type === 'text') {
      // Campos de descrição livre — extrai conteúdo entre aspas
      const descFields = ['propertyAddress', 'productName', 'projectScope', 'product', 'role', 'invoiceNumber', 'trackingCode', 'triggerEvent'];
      if (descFields.includes(variable.name)) {
        const quoted = message.match(/[""'']([^""'']{3,200})[""'']/);
        if (quoted) value = quoted[1];
      }
    }

    if (value) {
      extracted[variable.name] = value;
    } else if (variable.required) {
      unmatched.push(variable.name);
    }
  }

  // Gera follow-up pra próximo campo faltando
  const nextMissing = template.variables.find(
    v => v.required && !extracted[v.name] && !alreadyFilled[v.name]
  );

  const totalRequired = template.variables.filter(v => v.required).length;
  const totalFilled = Object.keys({ ...alreadyFilled, ...extracted }).filter(
    k => template.variables.find(v => v.name === k && v.required)
  ).length;

  const confidence = totalRequired === 0 ? 1 : totalFilled / totalRequired;

  return {
    fields: extracted,
    unmatched,
    confidence,
    followUpQuestion: nextMissing ? buildFollowUpQuestion(nextMissing) : undefined,
  };
}

/**
 * Constrói uma pergunta em linguagem natural para um campo
 */
function buildFollowUpQuestion(variable: SCVariable): string {
  const intros = [
    'Pra eu montar esse contrato, me diz só mais uma coisa:',
    'Falta uma informação pra fechar:',
    'Quase lá! Me passa:',
    'Pra continuar, preciso saber:',
  ];
  const intro = intros[Math.floor(Math.random() * intros.length)];

  let question = `**${variable.label}**`;
  if (variable.helper) question += ` — ${variable.helper.toLowerCase()}`;
  if (variable.type === 'address') question += '. Pode usar o **@handle** (ex: @lucas, @acme) ou colar o endereço Stellar (G...) se preferir';
  if (variable.type === 'amount') question += '. Pode usar formatos como 1000, 1k ou 1 mil';
  if (variable.type === 'date') question += '. Pode falar "dia 15/06/2026" ou "em 30 dias"';
  if (variable.type === 'select' && variable.options) {
    question += `. Opções: ${variable.options.join(', ')}`;
  }

  return `${intro}\n\n${question}`;
}

/**
 * Gera uma explicação em linguagem leiga do contrato configurado
 * Substitua o corpo desta função por uma chamada à Claude API quando plugar.
 */
export async function explainContract(
  template: SmartContractTemplate,
  variables: Record<string, string>
): Promise<AIExplainResult> {
  await new Promise(r => setTimeout(r, 800));

  const bulletPoints: string[] = [];
  const risks: AIExplainResult['risks'] = [];
  const whatHappensIf: AIExplainResult['whatHappensIf'] = [];

  let summary = template.plainLanguage;

  // ── 1. ALUGUEL RESIDENCIAL ──────────────────────────────
  if (template.id === 'rent') {
    const rent = variables.monthlyRent || '?';
    const months = variables.depositMonths || '3';
    const asset = variables.asset || 'BRZ';
    const dueDay = variables.dueDay || '5';
    const duration = variables.durationMonths || '30';
    const totalDeposit = parseFloat(rent) * parseFloat(months) || 0;

    if (variables.monthlyRent) {
      summary += `\n\n**Valores**: Aluguel mensal de ${rent} ${asset} + caução de ${totalDeposit} ${asset} (${months} aluguéis). Vencimento todo dia ${dueDay}.`;
    }

    bulletPoints.push(
      `O inquilino deposita **${totalDeposit > 0 ? totalDeposit + ' ' + asset : 'a caução'}** no início — esse valor fica travado no contrato`,
      `Todo dia ${dueDay}, o aluguel de **${rent} ${asset}** é debitado da carteira do inquilino para a do locador`,
      `Contrato dura **${duration} meses** (mínimo exigido pela Lei do Inquilinato é 30)`,
      `No fim, o locador faz vistoria e libera a caução; se houver dano comprovado, retém apenas o necessário e devolve o resto`,
    );
    risks.push(
      { level: 'medium', text: 'A carteira do inquilino precisa ter saldo todo mês — combine alerta automático' },
      { level: 'low', text: 'Retenção de caução exige comprovação on-chain (foto/laudo) — não é decisão unilateral' },
    );
    whatHappensIf.push(
      { scenario: 'Inquilino paga em dia', outcome: 'Locador recebe automaticamente todo mês, sem boleto/recibo' },
      { scenario: 'Inquilino atrasa', outcome: 'Contrato marca como inadimplente após D+5; locador pode acionar caução' },
      { scenario: 'Imóvel devolvido sem dano', outcome: `Caução de ${totalDeposit > 0 ? totalDeposit + ' ' + asset : '3 aluguéis'} volta integral em segundos` },
    );
  }

  // ── 2. E-COMMERCE ──────────────────────────────
  else if (template.id === 'ecommerce') {
    const amount = variables.amount || '?';
    const asset = variables.asset || 'BRZ';
    const product = variables.productName || 'o produto';
    const autoDays = variables.autoReleaseDays || '7';

    if (variables.amount) {
      summary += `\n\n**Venda de ${product}** por ${amount} ${asset}. Liberação automática em ${autoDays} dias se nada for disputado.`;
    }

    bulletPoints.push(
      `O comprador paga ${amount} ${asset}, mas o dinheiro **não vai direto pro vendedor** — fica retido no contrato`,
      `O vendedor envia o produto e cadastra o **código de rastreamento** on-chain`,
      `Quando o comprador clicar em "confirmar recebimento", o pagamento é liberado em segundos`,
      `Se o comprador sumir, após **${autoDays} dias** o sistema libera automaticamente para o vendedor`,
    );
    risks.push(
      { level: 'low', text: 'O comprador tem o controle final — se for inadimplente em confirmar, espere o prazo de auto-release' },
      { level: 'medium', text: 'Para produtos importados, ajuste o prazo de auto-release pra mais (ex: 30 dias)' },
    );
    whatHappensIf.push(
      { scenario: 'Produto chega ok', outcome: 'Comprador confirma → vendedor recebe na hora' },
      { scenario: 'Produto não chega ou veio errado', outcome: 'Comprador abre disputa → vendedor pode reembolsar' },
      { scenario: 'Comprador ignora após receber', outcome: `Em ${autoDays} dias o pagamento libera automaticamente — sem prejuízo ao vendedor` },
    );
  }

  // ── 3. FREELANCER ──────────────────────────────
  else if (template.id === 'freelancer') {
    const total = variables.totalAmount || '?';
    const asset = variables.asset || 'USDC';
    const count = variables.milestoneCount || '4';
    const perDelivery = parseFloat(total) / parseFloat(count) || 0;
    const reviewDays = variables.reviewDays || '5';

    if (variables.totalAmount) {
      summary += `\n\n**Projeto de ${total} ${asset}** dividido em ${count} entregas (${perDelivery.toFixed(2)} ${asset} cada). Cliente tem ${reviewDays} dias para revisar cada entrega.`;
    }

    bulletPoints.push(
      `O cliente deposita os **${total} ${asset}** no início — o freelancer sabe que o dinheiro existe`,
      `A cada entrega aprovada, o freelancer recebe **${perDelivery.toFixed(2)} ${asset}** automaticamente`,
      `O cliente tem **${reviewDays} dias** para aprovar ou rejeitar (com motivo) cada entrega`,
      `Se o cliente sumir, após esse prazo a entrega é **aprovada automaticamente** — proteção pro freelancer`,
    );
    risks.push(
      { level: 'medium', text: 'Defina critérios objetivos por entrega no escopo — evita "está feio, refaz"' },
      { level: 'low', text: 'O cliente pode rejeitar quantas vezes quiser dentro do prazo — combine limite de revisões' },
    );
    whatHappensIf.push(
      { scenario: 'Entrega aprovada', outcome: `Freelancer recebe ${perDelivery.toFixed(2)} ${asset} na hora` },
      { scenario: 'Entrega rejeitada', outcome: 'Freelancer revisa e submete de novo, o ciclo recomeça' },
      { scenario: 'Cliente sumiu', outcome: `Após ${reviewDays} dias sem resposta, aprovação automática libera a parcela` },
    );
  }

  // ── 4. FOLHA ──────────────────────────────
  else if (template.id === 'payroll') {
    const day = variables.payDay || '5';
    const asset = variables.asset || 'USDC';
    const employees = (variables.employees || '').split(',').filter(Boolean);
    const totalMonthly = employees.reduce((sum, e) => {
      const parts = e.split(':');
      return sum + (parseFloat(parts[1]) || 0);
    }, 0);

    if (employees.length > 0) {
      summary += `\n\n**${employees.length} funcionários** cadastrados, totalizando ~${totalMonthly.toFixed(2)} ${asset}/mês. Pagamento todo dia ${day}.`;
    }

    bulletPoints.push(
      `Lista de funcionários com salários individuais cadastrada on-chain`,
      `Todo dia **${day}** do mês, o contrato executa toda a folha em uma única transação atômica`,
      `A empresa não precisa de RH operacional — adicionar, remover ou pausar é uma transação`,
      `Cada funcionário tem comprovante on-chain do salário recebido`,
    );
    risks.push(
      { level: 'high', text: 'A carteira da empresa precisa ter saldo suficiente no dia do pagamento — falhou tudo, falhou geral' },
      { level: 'medium', text: 'Para folha CLT, ainda precisa pagar encargos (INSS/FGTS) — modelo ideal para PJ' },
    );
    whatHappensIf.push(
      { scenario: 'Dia do pagamento chega', outcome: 'Folha executa automaticamente — todos recebem em segundos' },
      { scenario: 'Saldo insuficiente', outcome: 'Transação falha — empresa precisa repor antes da próxima cobrança' },
      { scenario: 'Demissão', outcome: 'Remove funcionário em uma transação — não recebe próxima folha' },
    );
  }

  // ── 5. ROYALTIES ──────────────────────────────
  else if (template.id === 'royalties') {
    const beneficiaries = (variables.beneficiaries || '').split(',').filter(Boolean);
    const totalPct = beneficiaries.reduce((sum, b) => {
      const parts = b.split(':');
      return sum + (parseFloat(parts[1]) || 0);
    }, 0);

    if (beneficiaries.length > 0) {
      summary += `\n\n**${beneficiaries.length} beneficiários** cadastrados, totalizando ${totalPct}% (precisa fechar em 100%).`;
    }

    bulletPoints.push(
      `Cada pagamento recebido pelo contrato é **dividido imediatamente** entre os beneficiários`,
      `As proporções são fixas e auditáveis — não dá pra adulterar planilha`,
      `Quem recebe não precisa esperar fim de mês ou trimestre — recebe na hora da venda`,
      `Histórico completo de cada centavo recebido fica registrado on-chain`,
    );
    risks.push(
      { level: 'medium', text: 'A soma dos percentuais precisa ser exatamente 100% — caso contrário, sobra ou falta' },
      { level: 'low', text: 'Alterar percentuais exige aprovação de todos os beneficiários — combine antes' },
    );
    whatHappensIf.push(
      { scenario: 'Venda de R$ 100 entra', outcome: `Divisão imediata: ${beneficiaries.slice(0, 3).map(b => b.split(':').join(' fica com ') + '%').join(', ')}` },
      { scenario: 'Adicionar novo beneficiário', outcome: 'Precisa de aprovação on-chain de todos os atuais' },
    );
  }

  // ── 6. FACTORING ──────────────────────────────
  else if (template.id === 'factoring') {
    const face = variables.faceValue || '?';
    const asset = variables.asset || 'BRZ';
    const disc = variables.discountPct || '5';
    const paid = parseFloat(face) * (1 - parseFloat(disc) / 100) || 0;

    if (variables.faceValue) {
      summary += `\n\n**NF #${variables.invoiceNumber || ''}** de ${face} ${asset}. Investidor paga ${paid.toFixed(2)} ${asset} agora (${disc}% de desconto) e recebe ${face} ${asset} no vencimento.`;
    }

    bulletPoints.push(
      `A PME emite uma nota fiscal de **${face} ${asset}** com vencimento futuro`,
      `O investidor compra a NF pagando **${paid.toFixed(2)} ${asset}** hoje (${disc}% de desconto)`,
      `Quando o cliente final pagar a NF, o valor **vai direto para o investidor**, não para a PME`,
      `Se o cliente não pagar, contrato marca inadimplência — investidor assume o risco`,
    );
    risks.push(
      { level: 'high', text: `Risco de inadimplência do sacado — confira o histórico antes (KYC)` },
      { level: 'medium', text: 'Para taxas mais agressivas, ajuste o desconto conforme o risco do sacado' },
    );
    whatHappensIf.push(
      { scenario: 'Cliente paga em dia', outcome: `Investidor recebe ${face} ${asset} no vencimento (lucro de ${(parseFloat(face) - paid).toFixed(2)} ${asset})` },
      { scenario: 'Cliente atrasa', outcome: 'Contrato marca como inadimplente — investidor pode acionar judicialmente' },
    );
  }

  // ── 7. VESTING COFUNDADOR ──────────────────────────────
  else if (template.id === 'founder_vesting') {
    const cliff = variables.cliffMonths || '12';
    const total = variables.vestingMonths || '48';
    const totalAmount = variables.totalAmount || '?';
    const asset = variables.asset || 'USDC';
    const role = variables.role || 'cofundador';

    summary += `\n\n**${role}** com vesting de ${totalAmount} ${asset} em ${total} meses, cliff de ${cliff} meses.`;

    bulletPoints.push(
      `O cofundador **não recebe nada nos primeiros ${cliff} meses** (período de cliff)`,
      `Após o cliff, ${(parseFloat(totalAmount) / parseFloat(total) * parseFloat(cliff)).toFixed(0)} ${asset} ficam disponíveis de uma vez`,
      `Depois, mais ${(parseFloat(totalAmount) / parseFloat(total)).toFixed(0)} ${asset} liberam a cada mês até completar ${total} meses`,
      `Se o cofundador sair antes, o saldo não-liberado volta para a empresa automaticamente`,
    );
    risks.push(
      { level: 'medium', text: 'O cliff de 12 meses é padrão Silicon Valley — protege a empresa de saídas prematuras' },
      { level: 'low', text: 'Reduzir o vesting (ex: 24 meses) acelera o ownership mas pode gerar tributação concentrada' },
    );
    whatHappensIf.push(
      { scenario: 'Sai antes do cliff', outcome: 'Perde tudo — saldo volta para a empresa' },
      { scenario: `Sai no mês ${Math.floor(parseInt(total) / 2)}`, outcome: `Recebe ~50% do total liberado` },
      { scenario: `Completa os ${total} meses`, outcome: `Total de ${totalAmount} ${asset} liberado integralmente` },
    );
  }

  // ── 8. RENDA FIXA ──────────────────────────────
  else if (template.id === 'fixed_yield') {
    const principal = variables.principal || '?';
    const asset = variables.asset || 'USDC';
    const rate = variables.annualRate || '12';
    const term = variables.termMonths || '12';
    const finalValue = parseFloat(principal) * Math.pow(1 + parseFloat(rate) / 100, parseFloat(term) / 12) || 0;
    const gain = finalValue - parseFloat(principal);

    if (variables.principal) {
      summary += `\n\n**${principal} ${asset}** travados por ${term} meses a ${rate}% a.a. = ${finalValue.toFixed(2)} ${asset} no vencimento (ganho de ${gain.toFixed(2)} ${asset}).`;
    }

    bulletPoints.push(
      `Investidor deposita **${principal} ${asset}** e o contrato trava esse valor por ${term} meses`,
      `Durante esse período, o investidor **não consegue sacar** (ou só com penalidade, se configurado)`,
      `No vencimento, o resgate inclui principal + juros calculados automaticamente`,
      `Ideal pra capital que vai ficar parado mesmo — tipo reserva de longo prazo`,
    );
    risks.push(
      { level: 'high', text: 'Capital fica travado pelo prazo total — não é para reserva de emergência' },
      { level: 'medium', text: `Risco de inadimplência do emissor — analise quem está emitindo antes de investir` },
    );
    whatHappensIf.push(
      { scenario: `Espera os ${term} meses`, outcome: `Recebe ${finalValue.toFixed(2)} ${asset} (principal + ${gain.toFixed(2)} de juros)` },
      { scenario: 'Tenta sacar antes', outcome: variables.earlyWithdrawal === 'Não' ? 'Transação rejeitada — capital travado' : 'Recebe com penalidade de 2%' },
    );
  }

  // ── 9. GROUP BUY ──────────────────────────────
  else if (template.id === 'group_buy') {
    const price = variables.unitPrice || '?';
    const asset = variables.asset || 'BRZ';
    const min = variables.minParticipants || '20';
    const product = variables.product || 'o produto';
    const totalIfHit = parseFloat(price) * parseFloat(min) || 0;

    summary += `\n\n**${product}** por ${price} ${asset} cada se ${min} pessoas se comprometerem. Total se atingir: ${totalIfHit.toFixed(2)} ${asset}.`;

    bulletPoints.push(
      `Cada participante deposita ${price} ${asset} no contrato (não vai pro vendedor ainda)`,
      `Quando atingir **${min} participantes**, o vendedor pode sacar e a compra é confirmada`,
      `Se passar do prazo sem atingir o mínimo, **todos recebem 100% de volta** automaticamente`,
      `Ninguém é cobrado mais do que combinado — o contrato garante o desconto coletivo`,
    );
    risks.push(
      { level: 'low', text: 'Risco zero para o consumidor — se não bater meta, recebe tudo de volta' },
      { level: 'medium', text: 'Combine prazo realista — meta muito alta ou prazo muito curto desestimula' },
    );
    whatHappensIf.push(
      { scenario: `${min} pessoas se inscrevem`, outcome: 'Vendedor saca os fundos, compra confirmada para todos' },
      { scenario: `Só ${Math.floor(parseInt(min) / 2)} se inscrevem`, outcome: 'Meta não atingida → todos pegam reembolso integral' },
    );
  }

  // ── 10. SEGURO PARAMÉTRICO ──────────────────────────────
  else if (template.id === 'parametric_insurance') {
    const premium = variables.premium || '?';
    const payout = variables.payout || '?';
    const asset = variables.asset || 'USDC';
    const ratio = parseFloat(payout) / parseFloat(premium) || 0;
    const event = variables.triggerEvent || 'o evento configurado';

    summary += `\n\n**Prêmio**: ${premium} ${asset} · **Indenização**: ${payout} ${asset} (${ratio.toFixed(1)}x). **Gatilho**: ${event}.`;

    bulletPoints.push(
      `Segurado paga ${premium} ${asset} de prêmio e fica protegido até o vencimento`,
      `Se **${event}** acontecer (confirmado pelo oráculo), a indenização de ${payout} ${asset} é paga em segundos`,
      `Sem perícia, sem advogado, sem fila — o oráculo confirma o dado e o contrato paga sozinho`,
      `Se o evento não acontecer até o vencimento, o prêmio fica com o segurador como receita`,
    );
    risks.push(
      { level: 'high', text: 'Tudo depende do oráculo configurado — escolha fonte confiável (API oficial, Reflector, Chainlink)' },
      { level: 'medium', text: 'O evento precisa ser objetivo e mensurável — "voo atrasou 3h" funciona, "produto ruim" não' },
    );
    whatHappensIf.push(
      { scenario: `${event} ocorre`, outcome: `Oráculo confirma → segurado recebe ${payout} ${asset} em segundos` },
      { scenario: 'Não ocorre até vencimento', outcome: `Apólice expira, prêmio de ${premium} ${asset} fica com o segurador` },
    );
  }

  if (!template.isFullyImplemented && bulletPoints.length === 0) {
    bulletPoints.push(
      `Template em versão beta — UI completa, lógica Soroban simplificada`,
      `Hash do contrato é ancorado on-chain normalmente`,
      `Lógica completa será expandida em próxima iteração`,
    );
  }

  return { summary, bulletPoints, risks, whatHappensIf };
}

/**
 * Mensagem inicial do assistente IA para um template
 */
export function getWelcomeMessage(template: SmartContractTemplate): string {
  const tip = `\n\n💡 *Dica: você pode usar **@handles** em vez de endereços Stellar. Ex: @lucas, @acme, @maria.*`;

  const intros: Record<string, string> = {
    rent: `Vamos montar um **Aluguel Residencial** com caução automática! Me passa quem é o locador e o locatário, valor mensal e caução.\n\nEx: *"@imobiliaria_rio aluga para @maria por R$ 2.500/mês, caução de 3 meses, vencimento dia 5, contrato de 30 meses"*${tip}`,

    ecommerce: `**Venda Online com Garantia** — adeus golpe de marketplace.\n\nEx: *"@joao vende iPhone 15 para @maria por R$ 4.500"*${tip}`,

    freelancer: `**Contrato de Freelancer** com pagamento por entrega.\n\nEx: *"@acme contrata @ana por R$ 15.000 em 4 entregas pelo desenvolvimento do site"*${tip}`,

    payroll: `**Folha de Pagamento** corporativa no automático! Me passa quem paga (a empresa), o time e o dia do mês.\n\nEx: *"@acme paga time: @lucas 8k, @ana 6k, @joao 5k — todo dia 5 em USDC"*${tip}`,

    royalties: `**Royalties** com divisão automática! Me diz o produto e a divisão entre os criadores.\n\nEx: *"Música 'Saudade': @ana 70%, @startupx 20%, @joao 10%"*${tip}`,

    factoring: `**Antecipação de Recebíveis** — PME melhora capital de giro.\n\nEx: *"@acme (PME) emite NF de R$ 100mil para @startupx (sacado); @gabriel (investidor) compra com 5% de desconto, vencimento em 60 dias"*${tip}`,

    founder_vesting: `**Vesting de Cofundador** padrão Silicon Valley.\n\nEx: *"@startupx faz vesting de 500k USDC para @ana (CTO) em 48 meses com cliff de 12"*${tip}`,

    fixed_yield: `**Renda Fixa Tokenizada** — CDB em cripto.\n\nEx: *"@maria investe R$ 50.000 a 12% ao ano por 12 meses no @acme"*${tip}`,

    group_buy: `**Compra Coletiva** — destrava desconto se atingir meta.\n\nEx: *"@startupx vende iPhone com 10% off: R$ 500 por pessoa, mínimo 20 pessoas"*${tip}`,

    parametric_insurance: `**Seguro Paramétrico** com gatilho automático.\n\nEx: *"@acme segura @maria contra atraso do voo LATAM 3456 > 3h. Prêmio R$ 50, indenização R$ 500, oráculo @oracle_voos"*${tip}`,

    // ─── Profissional ──────────────────────
    legal_fees: `**Honorários Advocatícios** com entrada + mensal + êxito.\n\nEx: *"@dr_silva atua para @cliente_x. Entrada R$ 3.000, mensalidade R$ 800 por 12 meses, êxito 20% sobre o que recuperar"*${tip}`,

    medical_consultation: `**Plano de Consultas Médicas** pré-pago.\n\nEx: *"@dra_oliveira atende @paciente. 10 consultas a R$ 250, validade 6 meses, cardiologia"*${tip}`,

    dental_treatment: `**Tratamento Odontológico** pago por etapa.\n\nEx: *"@dr_dentista vai colocar implante em @paciente. R$ 8.000 em 4 etapas: cirurgia, cicatrização, prótese, ajuste"*${tip}`,

    accounting_services: `**Honorários Contábeis** mensais com SLA.\n\nEx: *"@contador_jr cuida da contabilidade de @loja_y. R$ 1.500/mês, entrega até dia 15, por 12 meses"*${tip}`,

    psychology_package: `**Pacote de Psicologia** com sigilo profissional.\n\nEx: *"@psi_clara atende @paciente. 8 sessões a R$ 200, validade 6 meses"*${tip}`,

    // ─── Construção ────────────────────────
    construction_contract: `**Empreitada de Obra** com marcos físicos.\n\nEx: *"@construtora_x ergue casa para @cliente_a, R$ 350.000 em 5 marcos, engenheiro @eng_carlos, retenção de 5%"*${tip}`,

    architectural_project: `**Projeto Arquitetônico** em 3 fases.\n\nEx: *"@arq_ana faz projeto residencial para @cliente. Total R$ 25.000: 20% estudo, 40% anteprojeto, 40% executivo"*${tip}`,

    renovation_milestone: `**Reforma com Pagamento por Etapa** + foto.\n\nEx: *"@empreiteiro_jose reforma cozinha do @cliente por R$ 18.000 em 4 etapas, prazo 60 dias"*${tip}`,

    // ─── Veículos ──────────────────────────
    vehicle_sale: `**Compra e Venda de Veículo** com escrow.\n\nEx: *"@vendedor vende Honda Civic 2020 ABC1D23 para @comprador por R$ 75.000, transferência em 30 dias"*${tip}`,

    vehicle_lease: `**Financiamento de Veículo** com alienação on-chain.\n\nEx: *"@financeira financia para @comprador. Entrada R$ 10k + 36x R$ 1.200, taxa 1,5% a.m., placa XYZ9A87"*${tip}`,

    car_rental_daily: `**Locação Diária** com caução automática.\n\nEx: *"@locadora_x aluga para @cliente. Placa ABC1234, 7 diárias de R$ 180, caução R$ 1.000, retirada amanhã"*${tip}`,

    // ─── RWA & Tokenização ─────────────────
    real_estate_token: `**Tokenização Imobiliária** — frações de imóvel.\n\nEx: *"@dono_imovel emite 1.000 cotas a R$ 500 do apto na Rua X. Aluguel mensal R$ 4.500 distribuído pro-rata"*${tip}`,

    commodity_token: `**Tokenização de Commodities** — CPR digital.\n\nEx: *"@produtor_rural emite 1.000 sacas de soja a R$ 150/saca, colheita em maio, Fazenda Boa Vista MT"*${tip}`,

    carbon_credits: `**Créditos de Carbono** tokenizados.\n\nEx: *"@projeto_x reflorestamento na Amazônia, 10.000 tCO₂ a USDC 15/t, certificadora @verra"*${tip}`,

    solar_yield_token: `**Tokenização Solar** — yield mensal.\n\nEx: *"@solar_co opera usina de 50kWp gerando 6.000 kWh/mês. 500 cotas a R$ 200, distribuição pro-rata"*${tip}`,

    // ─── Registros ─────────────────────────
    birth_registry: `**Registro de Nascimento** on-chain.\n\nEx: *"@cartorio_central lavra: João Silva, nascido em 15/05/2026, Hospital Albert Einstein, mãe @maria_silva"*${tip}`,

    marriage_contract: `**Contrato de União / Casamento** com regime de bens.\n\nEx: *"@noivo casa com @noiva, regime de comunhão parcial, cartório @cartorio_central, dia 20/06/2026"*${tip}`,

    divorce_settlement: `**Acordo de Divórcio** com pensão automática.\n\nEx: *"@ex_marido paga R$ 1.500/mês de pensão para @ex_esposa por 18 meses, assistido por @dr_silva"*${tip}`,

    death_certificate: `**Certidão de Óbito** com sucessão automática.\n\nEx: *"@cartorio registra óbito de João Silva em 10/05/2026, atestado por @dr_medico, causa CID I46"*${tip}`,

    notarized_declaration: `**Declaração Notarial** com fé pública on-chain.\n\nEx: *"@declarante assina procuração para @beneficiario, tabelião @cartorio, validade 6 meses"*${tip}`,

    // ─── Imóveis ───────────────────────────
    commercial_rent: `**Aluguel Comercial** com reajuste IPCA.\n\nEx: *"@imobiliaria aluga sala para @empresa_y, R$ 3.500/mês por 60 meses, caução de 3 aluguéis, IPCA anual"*${tip}`,

    short_stay: `**Aluguel por Temporada** estilo Airbnb.\n\nEx: *"@anfitriao recebe @hospede por 3 noites a USDC 80, taxa de limpeza USDC 30, caução USDC 200"*${tip}`,
  };

  return intros[template.id] || `Vamos configurar o contrato **${template.name}** juntos. Me conta sobre ele do seu jeito.${tip}`;
}

/**
 * Mensagem de confirmação quando todos os campos foram preenchidos
 */
export function getCompletionMessage(template: SmartContractTemplate): string {
  return `Beleza, **${template.name}** configurado! ✅\n\nDá uma olhada na aba **"Linguagem Simples"** pra ver o que esse contrato vai fazer na prática, e na aba **"Código Soroban"** pra revisar o que vai pra blockchain. Quando estiver pronto, é só clicar em **"Implantar na Testnet"**.`;
}
