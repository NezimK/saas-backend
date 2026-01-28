#!/usr/bin/env node
/**
 * Script pour supprimer tous les workflows archivés dans n8n
 * Usage: node scripts/delete-archived-workflows.js
 */

require('dotenv').config();

const N8N_API_URL = process.env.N8N_API_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

async function deleteArchivedWorkflows() {
  console.log('🔍 Récupération des workflows...\n');

  // Récupérer tous les workflows
  const response = await fetch(`${N8N_API_URL}/workflows`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Erreur API n8n: ${response.status} ${response.statusText}`);
  }

  const { data: workflows } = await response.json();
  const archivedWorkflows = workflows.filter(w => w.isArchived === true);

  if (archivedWorkflows.length === 0) {
    console.log('✅ Aucun workflow archivé à supprimer.');
    return;
  }

  console.log(`📦 ${archivedWorkflows.length} workflow(s) archivé(s) trouvé(s):\n`);
  archivedWorkflows.forEach(w => console.log(`   - ${w.name} (${w.id})`));
  console.log('');

  // Supprimer chaque workflow archivé
  let deleted = 0;
  let errors = 0;

  for (const workflow of archivedWorkflows) {
    try {
      const deleteResponse = await fetch(`${N8N_API_URL}/workflows/${workflow.id}`, {
        method: 'DELETE',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (deleteResponse.ok) {
        console.log(`   ✓ Supprimé: ${workflow.name}`);
        deleted++;
      } else {
        console.log(`   ✗ Erreur: ${workflow.name} (${deleteResponse.status})`);
        errors++;
      }
    } catch (err) {
      console.log(`   ✗ Erreur: ${workflow.name} - ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Terminé: ${deleted} supprimé(s), ${errors} erreur(s)`);
}

deleteArchivedWorkflows().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
