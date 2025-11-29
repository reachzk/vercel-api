const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// A função do Vercel recebe (req, res)
module.exports = async (req, res) => {
  // 1. Configuração de CORS para permitir requisições do seu frontend (Hostinger)
  res.setHeader('Access-Control-Allow-Origin', 'https://makeyourclips.com' ); // ⚠️ CORRIJA ESTA LINHA NO SEU REPOSITÓRIO
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Lida com a requisição OPTIONS (pré-voo do CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Verifica o método da requisição
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // 3. Extrai os dados da requisição (que antes vinham do `data` da função callable)
  const { priceId, userId, userEmail, quantity = 1 } = req.body;

  if (!priceId || !userId || !userEmail) {
    return res.status(400).json({ error: 'Missing required parameters: priceId, userId, or userEmail.' });
  }

  try {
    // 4. Busca ou cria o cliente Stripe (Lógica mantida)
    let customer;
    const stripeCustomers = await stripe.customers.list({ email: userEmail, limit: 1 });

    if (stripeCustomers.data.length > 0) {
      customer = stripeCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          firebaseUid: userId,
        },
      });
    }

    // 5. Cria a sessão de Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription', // Usamos 'subscription' para planos recorrentes
      customer: customer.id,
      line_items: [
        {
          price: priceId, // ID do preço do seu Plano Pro no Stripe
          quantity: quantity,
        },
      ],
      // URLs de redirecionamento após o pagamento
      success_url: 'https://makeyourclips.com/dashboard.html?payment=success', // Mantenha seus URLs
      cancel_url: 'https://makeyourclips.com/checkout.html?payment=cancelled', // Mantenha seus URLs
      // Passa o ID do usuário para o webhook
      metadata: {
        firebaseUid: userId,
      },
    } );

    // 6. Retorna o ID da sessão para o front-end
    return res.status(200).json({ sessionId: session.id });

  } catch (error) {
    console.error('Erro ao criar a sessão de checkout do Stripe:', error);
    return res.status(500).json({ error: 'Erro interno ao processar o pagamento.', details: error.message });
  }
};
