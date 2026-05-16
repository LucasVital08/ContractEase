import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as StellarSdk from 'https://esm.sh/@stellar/stellar-sdk@15';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { contractId, contractHash, network } = await req.json();

    const isTestnet = network !== 'mainnet';
    const horizonUrl = isTestnet ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org';
    const networkPassphrase = isTestnet ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC;

    const secretKey = Deno.env.get("STELLAR_SECRET_KEY");
    if (!secretKey) throw new Error("STELLAR_SECRET_KEY não configurada");

    const server = new StellarSdk.Horizon.Server(horizonUrl);
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    const account = await server.loadAccount(keypair.publicKey());

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: keypair.publicKey(),
          asset: StellarSdk.Asset.native(),
          amount: '0.0000001',
        })
      )
      .addMemo(StellarSdk.Memo.hash(contractHash))
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const result = await server.submitTransaction(tx);

    // Atualizar contrato no banco com o hash da transação (somente se contractId foi fornecido)
    if (contractId) {
      const { error: updateError } = await supabase
        .from('contracts')
        .update({
          stellar_tx_hash: result.hash,
          contract_hash: contractHash,
          status: 'active',
        })
        .eq('id', contractId);

      if (updateError) {
        console.error("Erro ao atualizar contrato no banco:", updateError);
        // Retorna sucesso parcial: âncora foi feita mas DB não atualizou
        return new Response(JSON.stringify({
          success: true,
          txHash: result.hash,
          ledger: result.ledger,
          warning: "Contrato ancorado na Stellar, mas falha ao atualizar banco de dados.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      txHash: result.hash,
      ledger: result.ledger,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
