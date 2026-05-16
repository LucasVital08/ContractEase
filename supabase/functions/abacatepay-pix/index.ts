import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ABACATE_API = "https://api.abacatepay.com/v2";
const ABACATE_KEY = Deno.env.get("ABACATEPAY_API_KEY") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://contractease.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { amount, description, metadata } = await req.json();
    console.log("🚀 Iniciando Fluxo de Pagamento V2:", { amount, description });

    if (!ABACATE_KEY) {
       throw new Error("ABACATEPAY_API_KEY não configurada no Supabase Secrets");
    }

    // PASSO 1: Criar o Produto Dinâmico (Necessário na V2 para Checkout Hospedado)
    const productRes = await fetch(`${ABACATE_API}/products/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ABACATE_KEY}`,
      },
      body: JSON.stringify({
        externalId: `prod-${metadata?.credits || 'custom'}-${Date.now()}`,
        name: description || `${metadata?.credits} Créditos - ContractEase`,
        price: amount,
        currency: "BRL"
      }),
    });

    const productData = await productRes.json();
    if (!productData.success) {
      throw new Error(`Erro ao criar produto: ${productData.error || JSON.stringify(productData)}`);
    }

    const productId = productData.data.id;
    console.log(`✅ Produto criado/localizado: ${productId}`);

    // PASSO 2: Criar o Checkout usando o ID do produto
    const checkoutRes = await fetch(`${ABACATE_API}/checkouts/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ABACATE_KEY}`,
      },
      body: JSON.stringify({
        frequency: "ONE_TIME",
        methods: ["PIX", "CARD"],
        items: [
          {
            id: productId,
            quantity: 1
          }
        ],
        returnUrl: `${APP_URL}/finance`,
        completionUrl: `${APP_URL}/finance?success=true`,
        metadata: metadata || undefined,
      }),
    });

    const checkoutData = await checkoutRes.json();
    console.log(`📥 Resposta Checkout (${checkoutRes.status}):`, JSON.stringify(checkoutData));

    if (!checkoutData.success) {
      throw new Error(`Erro ao criar checkout: ${checkoutData.error || JSON.stringify(checkoutData)}`);
    }

    return new Response(JSON.stringify({
      success: true,
      data: checkoutData.data
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    console.error("🔥 Erro Crítico na Função:", message);
    return new Response(JSON.stringify({
      success: false,
      error: message,
      context: "abacatepay-v2-flow",
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
