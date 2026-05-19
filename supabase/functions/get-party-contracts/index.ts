import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Obter usuário autenticado via JWT
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Buscar contratos onde o usuário é parte (via email ou ID)
    // Nota: contract_parties pode ter email ou user_id. Vamos cobrir ambos.
    const { data: parties, error: partiesError } = await supabase
      .from('contract_parties')
      .select('contract_id')
      .or(`email.eq.${user.email},user_id.eq.${user.id}`);

    if (partiesError) throw partiesError;

    if (!parties || parties.length === 0) {
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const contractIds = parties.map(p => p.contract_id);

    // Buscar detalhes dos contratos
    const { data: contracts, error: contractsError } = await supabase
      .from('contracts')
      .select('*, contract_parties(*), contract_clauses(*), favorites:favorites(id)')
      .in('id', contractIds);

    if (contractsError) throw contractsError;

    return new Response(JSON.stringify(contracts || []), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
