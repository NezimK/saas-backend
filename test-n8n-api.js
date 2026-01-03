require('dotenv').config();
const axios = require('axios');

async function testN8nAPI() {
  const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
      'X-N8N-API-KEY': process.env.N8N_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  try {
    console.log('📋 Récupération de tous les workflows...');
    const { data: workflows } = await n8nAPI.get('/workflows');

    console.log(`✅ ${workflows.data.length} workflow(s) trouvé(s)\n`);

    if (workflows.data.length > 0) {
      const firstWorkflow = workflows.data[0];
      console.log('📝 Premier workflow:');
      console.log('ID:', firstWorkflow.id);
      console.log('Name:', firstWorkflow.name);
      console.log('\n🔍 Structure complète (premières clés):');
      console.log(Object.keys(firstWorkflow));

      console.log('\n📦 Premier node (premières clés):');
      if (firstWorkflow.nodes && firstWorkflow.nodes[0]) {
        console.log(Object.keys(firstWorkflow.nodes[0]));
      }
    }

    console.log('\n\n🧪 Test de création d\'un workflow minimal...');
    const minimalWorkflow = {
      name: 'Test Minimal Workflow ' + Date.now(),
      nodes: [
        {
          name: 'Start',
          type: 'n8n-nodes-base.start',
          position: [250, 300],
          parameters: {},
          typeVersion: 1
        }
      ],
      connections: {},
      settings: {
        executionOrder: 'v1'
      }
    };

    console.log('📤 Envoi:', JSON.stringify(minimalWorkflow, null, 2));

    const { data: created } = await n8nAPI.post('/workflows', minimalWorkflow);
    console.log('✅ Workflow créé avec succès!');
    console.log('ID:', created.id);
    console.log('Name:', created.name);

    // Suppression du test
    await n8nAPI.delete(`/workflows/${created.id}`);
    console.log('🗑️  Workflow de test supprimé');

  } catch (error) {
    console.error('❌ Erreur:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

testN8nAPI();
