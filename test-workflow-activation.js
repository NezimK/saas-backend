require('dotenv').config();
const axios = require('axios');

async function testActivation() {
  const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
      'X-N8N-API-KEY': process.env.N8N_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  const workflowId = 'NrooRu51cONz9TU8'; // Le workflow qu'on vient de créer

  try {
    console.log('📋 Récupération du workflow...');
    const { data: workflow } = await n8nAPI.get(`/workflows/${workflowId}`);

    console.log('Workflow:', workflow.name);
    console.log('Active:', workflow.active);
    console.log('Toutes les clés:', Object.keys(workflow));

    console.log('\n🔄 Test 1: PATCH avec uniquement active...');
    try {
      await n8nAPI.patch(`/workflows/${workflowId}`, { active: true });
      console.log('✅ PATCH fonctionne!');
    } catch (e) {
      console.log('❌ PATCH échoue:', e.response?.data?.message || e.message);
    }

    console.log('\n🔄 Test 2: POST /activate...');
    try {
      const { data } = await n8nAPI.post(`/workflows/${workflowId}/activate`);
      console.log('✅ POST /activate fonctionne! Active:', data.active);
    } catch (e) {
      console.log('❌ POST /activate échoue:', e.response?.status, e.response?.data?.message || e.message);
    }

    console.log('\n🔄 Test 3: GET /activate (toggle)...');
    try {
      const { data } = await n8nAPI.get(`/workflows/${workflowId}/activate`);
      console.log('✅ GET /activate fonctionne! Active:', data.active);
    } catch (e) {
      console.log('❌ GET /activate échoue:', e.response?.status, e.response?.data?.message || e.message);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testActivation();
