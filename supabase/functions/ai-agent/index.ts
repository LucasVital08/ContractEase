// ───────────────────────────────────────────────────────────────────────
// Agente de IA (Gemini)
//
// [HIGH] Antes: endpoint anônimo com CORS `*`. Qualquer pessoa na internet
// usava a GEMINI_API_KEY da plataforma como proxy gratuito de LLM — custo
// direto no cartão do projeto, além de risco de a chave ser bloqueada por
// abuso. Também não havia limite de tamanho: um corpo de 10 MB virava um
// prompt de 10 MB.
//
// Agora: exige JWT, limita o tamanho da entrada e aplica rate limit por
// usuário. As saídas continuam sendo tratadas como NÃO CONFIÁVEIS pelo
// frontend (ver escapeHtml em SmartContractEditor.tsx) — conteúdo de contrato
// pode conter prompt injection.
// ───────────────────────────────────────────────────────────────────────

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { handler, jsonResponse, requireUser, HttpError } from '../_shared/security.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-1.5-flash';

/** Teto de caracteres por campo de entrada. */
const MAX_INPUT_CHARS = 40_000;

/** Rate limit simples em memória: N chamadas por janela, por usuário. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const callLog = new Map<string, number[]>();

function enforceRateLimit(userId: string): void {
  const now = Date.now();
  const recent = (callLog.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);

  if (recent.length >= RATE_LIMIT) {
    throw new HttpError(429, 'rate_limited', 'Muitas requisições. Tente novamente em instantes.');
  }

  recent.push(now);
  callLog.set(userId, recent);

  // Evita crescimento indefinido do mapa na instância.
  if (callLog.size > 5_000) {
    for (const [key, stamps] of callLog) {
      if (stamps.every((t) => now - t >= RATE_WINDOW_MS)) callLog.delete(key);
    }
  }
}

function clamp(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  if (text.length > MAX_INPUT_CHARS) {
    throw new HttpError(413, 'input_too_large', `Campo "${field}" excede ${MAX_INPUT_CHARS} caracteres.`);
  }
  return text;
}

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);
  enforceRateLimit(user.id);

  if (!GEMINI_API_KEY) {
    throw new HttpError(500, 'gemini_not_configured', 'GEMINI_API_KEY não configurada.');
  }

  const { action, contractContent, userMessage, prompt, contracts } = await req.json();

  // Sem inicializador: o `default` lança, então toda saída do switch tem valor.
  let systemPrompt: string;
  let userPrompt: string;

  switch (action) {
    case 'analyze':
      systemPrompt = 'Você é um especialista jurídico brasileiro. Analise o contrato fornecido e retorne um JSON com: score (0-100), summary (resumo executivo), e risks (lista de riscos identificados).';
      userPrompt = `Analise o seguinte contrato: ${clamp(contractContent, 'contractContent')}`;
      break;
    case 'chat':
      systemPrompt = 'Você é um assistente jurídico prestativo. Responda às perguntas sobre o contrato fornecido de forma clara e concisa.';
      userPrompt = `Contrato: ${clamp(contractContent, 'contractContent')}\n\nPergunta: ${clamp(userMessage, 'userMessage')}`;
      break;
    case 'generate':
      systemPrompt = 'Você é um gerador de contratos jurídicos. Crie um contrato baseado no prompt do usuário. Retorne APENAS o JSON do contrato.';
      userPrompt = `Gere um contrato com as seguintes características: ${clamp(prompt, 'prompt')}`;
      break;
    case 'dashboard_insights':
      systemPrompt = 'Você é um analista de dados. Forneça insights baseados na lista de contratos fornecida.';
      userPrompt = `Insights para os seguintes contratos: ${clamp(contracts, 'contracts')}`;
      break;
    default:
      throw new HttpError(400, 'unsupported_action', 'Ação não suportada.');
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      }),
    },
  );

  const data = await res.json();
  if (!res.ok) {
    // A mensagem crua da Gemini pode conter fragmentos da chave/quota: fica no log.
    console.error('[ai-agent] erro da Gemini:', data?.error);
    throw new HttpError(502, 'gemini_error', 'Falha ao consultar o modelo.');
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return jsonResponse(req, 200, { text });
}));
