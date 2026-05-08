import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Configuração da Carteira da Plataforma (Deve ser alterada para produção)
const PLATFORM_WALLET = Deno.env.get("STELLAR_PLATFORM_WALLET") || "GB...PLATFORM...WALLET";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log("📥 Request Body:", JSON.stringify(body));
    const { amount, credits, userId } = body;

    if (!userId) {
      console.error("❌ userId is missing in request");
      throw new Error("userId é obrigatório");
    }

    // 1. Verificar se já existe um pagamento pendente idêntico
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending_stellar')
      .eq('credits_added', credits)
      .eq('method', 'STELLAR')
      .maybeSingle();

    if (existingPayment) {
      console.log("♻️ Usando pagamento pendente existente:", existingPayment.stellar_memo);
      return new Response(JSON.stringify({
        success: true,
        data: {
          memo: existingPayment.stellar_memo,
          walletAddress: PLATFORM_WALLET,
          amount: existingPayment.amount,
          paymentId: existingPayment.id,
          instruction: `Aguardando transferência para a carteira ${PLATFORM_WALLET} com o MEMO: ${existingPayment.stellar_memo}`
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerar Memo Aleatório (8 caracteres alfanuméricos)
    const memo = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Criar registro de pagamento pendente
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount: amount,
        credits_added: credits,
        status: 'pending_stellar',
        method: 'STELLAR',
        stellar_memo: memo
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    return new Response(JSON.stringify({
      success: true,
      data: {
        memo: memo,
        walletAddress: PLATFORM_WALLET,
        amount: amount,
        paymentId: payment.id,
        instruction: `Envie o pagamento para a carteira ${PLATFORM_WALLET} com o MEMO: ${memo}`
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
