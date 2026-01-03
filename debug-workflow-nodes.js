/**
 * Debug les nodes du workflow pour voir comment le token est passé
 */

require('dotenv').config();
const axios = require('axios');

const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'Content-Type': 'application/json'
    }
});

async function debugWorkflow(workflowId) {
    try {
        console.log(`🔍 Analyse du workflow: ${workflowId}\n`);

        const { data: workflow } = await n8nAPI.get(`/workflows/${workflowId}`);

        // Node "Get Access Token"
        const tokenNode = workflow.nodes.find(n => n.name === 'Get Access Token');
        console.log('1️⃣  Node "Get Access Token":');
        console.log(JSON.stringify(tokenNode.parameters, null, 2));

        // Node "List Gmail Messages"
        const listNode = workflow.nodes.find(n => n.name === 'List Gmail Messages');
        console.log('\n2️⃣  Node "List Gmail Messages":');
        console.log(JSON.stringify(listNode.parameters, null, 2));

        // Vérifier la connexion entre les deux
        const connections = workflow.connections['Get Access Token'];
        console.log('\n3️⃣  Connexion "Get Access Token" → "List Gmail Messages":');
        console.log(JSON.stringify(connections, null, 2));

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data || error.message);
    }
}

const workflowId = process.argv[2] || 'DeTiJsXeRMiXi53c';
debugWorkflow(workflowId);
