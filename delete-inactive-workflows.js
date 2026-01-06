/**
 * Script pour supprimer automatiquement les workflows Email Parser inactifs
 * Usage: node delete-inactive-workflows.js
 */

require('dotenv').config();
const axios = require('axios');

const n8nAPI = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: {
    'X-N8N-API-KEY': process.env.N8N_API_KEY
  }
});

async function deleteInactiveWorkflows() {
  console.log('🔍 Recherche des workflows Email Parser inactifs...\n');

  try {
    // Récupérer tous les workflows
    const response = await n8nAPI.get('/workflows');
    const workflows = response.data.data || response.data;

    // Filtrer les workflows Email Parser inactifs
    const emailParserWorkflows = workflows.filter(w =>
      w.name.startsWith('Email Parser -') && !w.active
    );

    if (emailParserWorkflows.length === 0) {
      console.log('✅ Aucun workflow Email Parser inactif à supprimer');
      return;
    }

    console.log(`📋 ${emailParserWorkflows.length} workflow(s) Email Parser inactif(s) trouvé(s)\n`);
    console.log('🗑️  Suppression en cours...\n');

    let deleted = 0;
    let errors = 0;

    for (const workflow of emailParserWorkflows) {
      try {
        await n8nAPI.delete(`/workflows/${workflow.id}`);
        console.log(`✅ Supprimé: ${workflow.name} (ID: ${workflow.id})`);
        deleted++;
      } catch (error) {
        console.error(`❌ Erreur pour ${workflow.name}:`, error.response?.data?.message || error.message);
        errors++;
      }
    }

    console.log(`\n📊 Résumé:`);
    console.log(`   ✅ Supprimés: ${deleted}`);
    console.log(`   ❌ Erreurs: ${errors}`);

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

deleteInactiveWorkflows();
