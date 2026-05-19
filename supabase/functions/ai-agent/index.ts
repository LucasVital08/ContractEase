import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-1.5-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, contractContent, userMessage, prompt, contracts } = await req.json();
    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "analyze":
        systemPrompt = "Você é um especialista jurídico brasileiro. Analise o contrato fornecido e retorne um JSON com: score (0-100), summary (resumo executivo), e risks (lista de riscos identificados).";
        userPrompt = `Analise o seguinte contrato: ${contractContent}`;
        break;
      case "chat":
        systemPrompt = "Você é um assistente jurídico prestativo. Responda às perguntas sobre o contrato fornecido de forma clara e concisa.";
        userPrompt = `Contrato: ${contractContent}\n\nPergunta: ${userMessage}`;
        break;
      case "generate":
        systemPrompt = "Você é um gerador de contratos jurídicos. Crie um contrato baseado no prompt do usuário. Retorne APENAS o JSON do contrato.";
        userPrompt = `Gere um contrato com as seguintes características: ${prompt}`;
        break;
      case "dashboard_insights":
        systemPrompt = "Você é um analista de dados. Forneça insights baseados na lista de contratos fornecida.";
        userPrompt = `Insights para os seguintes contratos: ${JSON.stringify(contracts)}`;
        break;
      default:
        throw new Error("Ação não suportada");
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] }
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Erro na API do Gemini");

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
