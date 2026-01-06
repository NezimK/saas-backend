/**
 * Script pour supprimer les workflows Email Parser inactifs
 * Usage: node cleanup-workflows.js
 */

require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

const n8nAPI = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: {
    'X-N8N-API-KEY': process.env.N8N_API_KEY
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function cleanupWorkflows() {
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
      rl.close();
      return;
    }

    console.log(`📋 ${emailParserWorkflows.length} workflow(s) Email Parser inactif(s) trouvé(s):\n`);

    emailParserWorkflows.forEach((w, i) => {
      console.log(`${i + 1}. ${w.name} (ID: ${w.id})`);
      console.log(`   Créé: ${w.createdAt}`);
      console.log(`   Actif: ${w.active ? '✅ Oui' : '❌ Non'}\n`);
    });

    // Demander confirmation
    const answer = await question(`\n⚠️  Voulez-vous supprimer ces ${emailParserWorkflows.length} workflow(s) ? (oui/non): `);

    if (answer.toLowerCase() !== 'oui') {
      console.log('❌ Suppression annulée');
      rl.close();
      return;
    }

    // Supprimer les workflows
    console.log('\n🗑️  Suppression en cours...\n');

    let deleted = 0;
    let errors = 0;

    for (const workflow of emailParserWorkflows) {
      try {
        await n8nAPI.delete(`/workflows/${workflow.id}`);
        console.log(`✅ Supprimé: ${workflow.name}`);
        deleted++;
      } catch (error) {
        console.error(`❌ Erreur pour ${workflow.name}:`, error.response?.data?.message || error.message);
        errors++;
      }
    }

    console.log(`\n📊 Résumé:`);
    console.log(`   ✅ Supprimés: ${deleted}`);
    console.log(`   ❌ Erreurs: ${errors}`);

    rl.close();

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
    rl.close();
  }
}

cleanupWorkflows();
