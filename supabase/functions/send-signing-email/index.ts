import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") || "https://contractease.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, signerName, contractTitle, contractId, partyId } = await req.json();

    if (!to || !contractId) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: to, contractId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY não configurada. Email não enviado.");
      return new Response(JSON.stringify({ success: true, message: "Serviço de email não configurado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // URL inclui partyId para identificar o signatário na página pública
    const signingUrl = partyId
      ? `${APP_URL}/sign/${contractId}/${partyId}`
      : `${APP_URL}/sign/${contractId}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "ContractEase <noreply@contractease.com>",
        to: [to],
        subject: `Convite para Assinar: ${contractTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #10b981;">Olá, ${signerName || "Signatário"}!</h2>
            <p>Você foi convidado(a) para assinar o documento:</p>
            <p style="font-weight: bold; font-size: 18px;">${contractTitle}</p>
            <p>Clique no botão abaixo para revisar e assinar com segurança:</p>
            <a href="${signingUrl}"
               style="display:inline-block; background-color: #10b981; color: white;
                      padding: 12px 28px; text-decoration: none; border-radius: 8px;
                      font-weight: bold; margin: 16px 0;">
              Assinar Documento
            </a>
            <p style="color: #6b7280; font-size: 13px;">
              Ou acesse o link: <a href="${signingUrl}">${signingUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">
              ContractEase — Contratos digitais com prova de existência na blockchain Stellar.
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Falha ao enviar email");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
