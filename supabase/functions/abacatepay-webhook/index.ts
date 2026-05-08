import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Bypass RLS to update profile
    );

    const payload = await req.json();
    const { event, data } = payload;

    console.log(`🔔 Evento recebido: ${event}`);

    // Handle Subscription/Plan Checkout
    if (event === 'checkout.completed' || event === 'subscription.completed') {
      const userId = data.metadata?.userId;
      const planId = data.metadata?.planId;

      if (userId && planId) {
        // 1. Update user profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            plan: planId,
            abacate_customer_id: data.customerId,
            abacate_subscription_id: data.id 
          })
          .eq('id', userId);

        if (profileError) throw profileError;

        // 2. Log payment
        await supabase
          .from('payments')
          .insert({
            user_id: userId,
            abacate_checkout_id: data.id,
            amount: data.amount,
            status: 'completed',
            method: data.methods?.[0] || 'PIX'
          });

        // 3. Notification
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            title: 'Assinatura Ativada! 🎉',
            message: `Parabéns! Seu plano ${planId.toUpperCase()} já está ativo.`,
            type: 'success'
          });

        console.log(`✅ Usuário ${userId} atualizado para o plano ${planId}`);
      }
    }

    // Handle Billing (Credits)
    if (event === 'billing.completed' || event === 'billing.paid') {
       const userId = data.metadata?.userId;
       const creditsToAdd = data.metadata?.credits;

       if (userId && creditsToAdd) {
          // 1. Get current credits
          const { data: profile } = await supabase
             .from('profiles')
             .select('credits')
             .eq('id', userId)
             .single();
          
          const newCredits = (profile?.credits || 0) + Number(creditsToAdd);

          // 2. Update profile
          await supabase
             .from('profiles')
             .update({ credits: newCredits })
             .eq('id', userId);

          // 3. Log payment
          await supabase
            .from('payments')
            .insert({
              user_id: userId,
              abacate_checkout_id: data.id,
              amount: data.amount,
              status: 'completed',
              method: 'PIX',
              credits_added: creditsToAdd
            });

          // 4. Notification
          await supabase
            .from('notifications')
            .insert({
              user_id: userId,
              title: 'Créditos Adicionados! ⚡',
              message: `Você recebeu ${creditsToAdd} novos créditos de ancoragem.`,
              type: 'success'
            });
            
          console.log(`✅ Adicionado ${creditsToAdd} créditos ao usuário ${userId}`);
       }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`❌ Erro no Webhook:`, err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  }
});
