// api/process-video.js

// Importa o Firebase Admin SDK para interagir com o Firestore
const admin = require('firebase-admin');

// Inicializa o Firebase Admin SDK (necessário para funções de backend)
// O Vercel deve ter a variável de ambiente FIREBASE_SERVICE_ACCOUNT
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error("Erro ao inicializar o Firebase Admin SDK:", error);
    return;
  }
}

const db = admin.firestore();

// Função principal da Vercel
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { videoUrl, jobId } = req.body;

    if (!videoUrl || !jobId) {
      return res.status(400).json({ error: 'Missing videoUrl or jobId' });
    }

    console.log(`[AI Process] Job received: ${jobId}. Video URL: ${videoUrl}`);

    // 1. Simulação de Processamento AI
    // Na vida real, você chamaria sua API de AI aqui.
    // Para fins de teste, simulamos um atraso de 10 segundos.
    await new Promise(resolve => setTimeout(resolve, 10000)); 

    // 2. Simulação de Resultados
    const simulatedCuts = [
      { url: 'https://exemplo.com/cut1.mp4', duration: '0:15' },
      { url: 'https://exemplo.com/cut2.mp4', duration: '0:22' },
      { url: 'https://exemplo.com/cut3.mp4', duration: '0:10' },
    ];

    // 3. Atualiza o status do Job no Firestore
    await db.collection('jobs' ).doc(jobId).update({
      status: 'completed',
      cuts: simulatedCuts,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[AI Process] Job ${jobId} completed and status updated.`);

    res.status(200).json({ success: true, message: 'Processing simulated and job updated.' });

  } catch (error) {
    console.error('Error in process-video function:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};
