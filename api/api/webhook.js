const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Função auxiliar para ler o corpo da requisição (necessário para webhooks)
const getRawBody = (req) => {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', (err) => {
      reject(err);
    });
  });
};

// Inicializa o Firebase Admin SDK (se ainda não estiver inicializado)
const initializeFirebase = () => {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
  return getFirestore();
};

module.exports = async (req, res) => {
  // 1. Verifica o método da requisição
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // 2. Obtém o corpo da requisição e a assinatura
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // Variável de ambiente do Vercel
  const rawBody = await getRawBody(req);

  let event;

  try {
    // 3. Constrói o evento de forma segura
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error(`❌ Erro de verificação do Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 4. Processa o evento
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('✅ Checkout Session Completed:', session.id);
      
      const firebaseUid = session.metadata.firebaseUid;
      const subscriptionId = session.subscription;
      
      // Obtém o ID do preço para determinar o plano
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      const priceId = lineItems.data[0].price.id;

      // Mapeamento de Price ID para Nome do Plano
      const planMap = {
          "price_1SYaGXDfgcwj7w4JoZD3DWZ7": "basico",
          "price_1SYaGDDfgcwj7w4JxsDaIg53": "pro",
          "price_1SYaGnDfgcwj7w4JmHvotoSR": "ilimitado"
      };
      const planName = planMap[priceId] || "desconhecido";

      // ⚠️ Lógica de Negócio: Atualizar o Firestore
      if (firebaseUid) {
        try {
          const db = initializeFirebase();
          await db.collection('users').doc(firebaseUid).set({
            stripeCustomerId: session.customer,
            stripeSubscriptionId: subscriptionId,
            planStatus: 'active',
            plan: planName, // Usa o nome do plano correto
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          console.log(`✅ Usuário ${firebaseUid} atualizado para plano ${planName}.`);
        } catch (e) {
          console.error("Erro ao atualizar Firestore:", e);
          // Não retorna erro 500 para o Stripe, apenas loga
        }
      }
      
      break;
      
    // ... (outros casos como invoice.payment_failed e customer.subscription.deleted)
    // A lógica para estes casos também deve usar initializeFirebase() e db.collection('users')...
      
    default:
      console.log(`Evento Stripe não tratado: ${event.type}`);
  }

  // 5. Retorna um 200 para o Stripe
  res.json({ received: true });
};
