/**
 * Récupère un workflow par son nom
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

async function getWorkflowByName(searchName) {
    try {
        console.log(`🔍 Recherche du workflow: "${searchName}"\n`);

        // Récupérer tous les workflows
        const { data: workflows } = await n8nAPI.get('/workflows');

        // Trouver celui qui correspond
        const workflow = workflows.data.find(w =>
            w.name.toLowerCase().includes(searchName.toLowerCase())
        );

        if (!workflow) {
            console.log('❌ Workflow non trouvé');
            console.log('\n📋 Workflows disponibles:');
            workflows.data.forEach(w => {
                console.log(`   - ${w.name} (ID: ${w.id})`);
            });
            return;
        }

        console.log(`✅ Workflow trouvé: ${workflow.name}`);
        console.log(`   ID: ${workflow.id}`);
        console.log(`   Active: ${workflow.active}`);

        // Récupérer les détails complets
        const { data: fullWorkflow } = await n8nAPI.get(`/workflows/${workflow.id}`);

        // Analyser les nodes
        console.log(`\n📋 Nodes du workflow (${fullWorkflow.nodes.length} total):\n`);

        fullWorkflow.nodes.forEach((node, index) => {
            console.log(`${index + 1}. ${node.name} (${node.type})`);

            // Si c'est un webhook, afficher les détails
            if (node.type.includes('webhook') || node.type.includes('Webhook')) {
                console.log('   📡 WEBHOOK NODE:');
                console.log('   Parameters:', JSON.stringify(node.parameters, null, 4));
            }

            // Si c'est un trigger email, afficher les détails
            if (node.type.includes('email') || node.type.includes('Email')) {
                console.log('   📧 EMAIL NODE:');
                console.log('   Parameters:', JSON.stringify(node.parameters, null, 4));
            }
        });

        // Sauvegarder le workflow complet dans un fichier pour analyse
        const fs = require('fs');
        const filename = `workflow-${workflow.id}.json`;
        fs.writeFileSync(filename, JSON.stringify(fullWorkflow, null, 2));
        console.log(`\n💾 Workflow complet sauvegardé dans: ${filename}`);

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data || error.message);
    }
}

const searchName = process.argv[2] || 'Email Parser - Portails Immobiliers';
getWorkflowByName(searchName);
