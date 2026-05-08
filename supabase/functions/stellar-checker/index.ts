import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLATFORM_WALLET = Deno.env.get("STELLAR_PLATFORM_WALLET") || "";
const HORIZON_URL = Deno.env.get("STELLAR_NETWORK") === "testnet" 
  ? "https://horizon-testnet.stellar.org" 
  : "https://horizon.stellar.org";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!PLATFORM_WALLET) throw new Error("STELLAR_PLATFORM_WALLET não configurada");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar pagamentos pendentes do Stellar
    const { data: pendingPayments, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('status', 'pending_stellar')
      .eq('method', 'STELLAR');

    if (fetchError) throw fetchError;
    if (!pendingPayments || pendingPayments.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum pagamento pendente para verificar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🔍 Verificando ${pendingPayments.length} pagamentos pendentes na carteira ${PLATFORM_WALLET}...`);

    // 2. Buscar transações recentes na rede Stellar
    // Limitamos a 50 transações recentes para performance
    const stellarRes = await fetch(`${HORIZON_URL}/accounts/${PLATFORM_WALLET}/payments?order=desc&limit=50`);
    const stellarData = await stellarRes.json();
    
    if (!stellarData._embedded || !stellarData._embedded.records) {
      throw new Error("Falha ao buscar registros do Horizon");
    }

    const transactions = stellarData._embedded.records;
    const processedMemos = [];

    // 3. Cruzar dados
    for (const payment of pendingPayments) {
      // Para cada pagamento no banco, procuramos uma transação no Stellar com o mesmo MEMO
      // Nota: Precisamos buscar os detalhes da transação para pegar o MEMO (o endpoint /payments nem sempre traz o memo na raiz)
      // OTIMIZAÇÃO: Em produção, seria melhor buscar por transações e filtrar pelo memo diretamente se possível, 
      // ou iterar pelas transações e buscar no banco.
      
      for (const tx of transactions) {
        // Buscamos o detalhe da transação para obter o MEMO
        const txDetailRes = await fetch(tx._links.transaction.href);
        const txDetail = await txDetailRes.json();

        if (txDetail.memo === payment.stellar_memo) {
          console.log(`🎯 MATCH! Memo ${payment.stellar_memo} encontrado na transação ${txDetail.hash}`);

          // 4. Confirmar Pagamento
          const { error: updateError } = await supabase.rpc('confirm_stellar_payment', {
            p_payment_id: payment.id,
            p_user_id: payment.user_id,
            p_credits: payment.credits_added,
            p_tx_hash: txDetail.hash
          });

          if (updateError) {
            console.error(`❌ Erro ao confirmar pagamento ${payment.id}:`, updateError);
          } else {
            processedMemos.push(payment.stellar_memo);
          }
          break; // Vai para o próximo pagamento pendente
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      verified_count: processedMemos.length,
      processed_memos: processedMemos
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("🔥 Erro no Checker:", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
