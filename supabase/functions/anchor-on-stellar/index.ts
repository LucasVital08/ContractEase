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

  // Etapa atual — usada para reportar onde a falha aconteceu
  let stage: string = 'init';

  try {
    stage = 'env_check';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const secretKey = Deno.env.get("STELLAR_SECRET_KEY");

    if (!secretKey) {
      console.error("[anchor-on-stellar] STELLAR_SECRET_KEY não configurada");
      return new Response(JSON.stringify({
        error: "STELLAR_SECRET_KEY não configurada na Edge Function",
        hint: "Configure no Supabase: Edge Functions → Secrets → STELLAR_SECRET_KEY (S... da testnet)",
        stage,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    stage = 'parse_body';
    const { contractId, contractHash, network } = await req.json();
    if (!contractHash) {
      return new Response(JSON.stringify({ error: "contractHash obrigatório", stage }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isTestnet = network !== 'mainnet';
    const horizonUrl = isTestnet ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org';
    const networkPassphrase = isTestnet ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC;

    stage = 'load_keypair';
    let keypair: StellarSdk.Keypair;
    try {
      keypair = StellarSdk.Keypair.fromSecret(secretKey);
    } catch (kpErr) {
      throw new Error(`STELLAR_SECRET_KEY inválida (não começa com S ou tem formato errado): ${(kpErr as Error).message}`, { cause: kpErr });
    }

    stage = 'load_account';
    const server = new StellarSdk.Horizon.Server(horizonUrl);
    let account;
    try {
      account = await server.loadAccount(keypair.publicKey());
    } catch (accErr) {
      const msg = (accErr as Error).message;
      if (msg.includes('Not Found') || msg.includes('404')) {
        throw new Error(`Conta custodial ${keypair.publicKey()} não existe na ${isTestnet ? 'testnet' : 'mainnet'}. Faça friendbot: https://friendbot.stellar.org/?addr=${keypair.publicKey()}`, { cause: accErr });
      }
      throw new Error(`Falha ao carregar conta na Horizon: ${msg}`, { cause: accErr });
    }

    stage = 'build_tx';
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

    stage = 'submit_tx';
    let result;
    try {
      result = await server.submitTransaction(tx);
    } catch (submitErr: unknown) {
      const horizonError = (submitErr as any)?.response?.data;
      const codes = horizonError?.extras?.result_codes;
      const detail = codes ? JSON.stringify(codes) : (submitErr as Error).message;
      throw new Error(`Stellar rejeitou a transação: ${detail}`, { cause: submitErr });
    }

    stage = 'update_db';
    if (contractId && supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { error: updateError } = await supabase
        .from('contracts')
        .update({
          stellar_tx_hash: result.hash,
          contract_hash: contractHash,
          status: 'active',
        })
        .eq('id', contractId);

      if (updateError) {
        console.error("[anchor-on-stellar] DB update failed:", updateError);
        return new Response(JSON.stringify({
          success: true,
          txHash: result.hash,
          ledger: result.ledger,
          warning: `Ancorado na Stellar, mas falha ao atualizar DB: ${updateError.message}`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      txHash: result.hash,
      ledger: result.ledger,
      network: isTestnet ? 'testnet' : 'mainnet',
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = (err as Error).message ?? String(err);
    console.error(`[anchor-on-stellar] failed at stage='${stage}':`, message);
    return new Response(JSON.stringify({ error: message, stage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
