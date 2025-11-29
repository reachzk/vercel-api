const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ⚠️ IMPORTANTE: Configuração do Firebase Admin SDK para Vercel
// O código abaixo assume que você adicionará a variável de ambiente FIREBASE_SERVICE_ACCOUNT
// com o conteúdo do JSON do Service Account do Firebase.

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

      // ⚠️ Lógica de Negócio (AQUI VOCÊ DEVE ADICIONAR A LÓGICA REAL DO FIREBASE)
      console.log(`[SIMULAÇÃO] Usuário ${firebaseUid} atualizado para plano PRO.`);
      // Exemplo de como seria a lógica real (descomente e configure o Firebase Admin SDK):
      /*
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({ credential: cert(serviceAccount) });
        const db = getFirestore();

        if (firebaseUid) {
          await db.collection('users').doc(firebaseUid).set({
            stripeCustomerId: session.customer,
            stripeSubscriptionId: subscriptionId,
            planStatus: 'active',
            plan: 'pro',
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          console.log(`✅ Usuário ${firebaseUid} atualizado para plano PRO.`);
        }
      }
      */
      
      break;
      
    case 'invoice.payment_failed':
      const invoice = event.data.object;
      console.log('❌ Pagamento falhou para a fatura:', invoice.id);
      // Lógica para lidar com falha de pagamento
      break;
      
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      console.log('❌ Assinatura cancelada:', subscription.id);
      // Lógica para rebaixar o plano do usuário
      break;
      
    default:
      console.log(`Evento Stripe não tratado: ${event.type}`);
  }

  // 5. Retorna um 200 para o Stripe
  res.json({ received: true });
};
