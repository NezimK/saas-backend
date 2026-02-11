#!/usr/bin/env node
require('dotenv').config();
const workflowService = require('../services/workflowService');

/**
 * Script CLI pour generer le workflow Email Parser Outlook dans n8n
 * pour un tenant donne.
 *
 * Usage:
 *   node scripts/generate-outlook-workflow.js --tenantId=mon-tenant-001
 *   node scripts/generate-outlook-workflow.js --tenantId=mon-tenant-001 --credentialId=abc123
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    tenantId: null,
    credentialId: null,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--tenantId=')) {
      options.tenantId = arg.split('=')[1];
    } else if (arg.startsWith('--credentialId=')) {
      options.credentialId = arg.split('=')[1];
    }
  }

  return options;
}

function showHelp() {
  console.log(`
  Generate Outlook Email Parser Workflow
  =======================================

  Cree un workflow Email Parser Outlook dans n8n pour un tenant.
  Le workflow poll les emails Outlook toutes les minutes, filtre par portail
  immobilier, et traite les leads automatiquement.

  Usage:
    node scripts/generate-outlook-workflow.js --tenantId=<id> [--credentialId=<id>]

  Options:
    --tenantId=<id>       (requis) L'identifiant du tenant dans Supabase
    --credentialId=<id>   (optionnel) L'ID du credential Outlook dans n8n.
                          Si non fourni, utilise outlook_credential_id du tenant.
    --help, -h            Affiche cette aide

  Exemples:
    node scripts/generate-outlook-workflow.js --tenantId=903aa3c1-34ee-4ce3-9c1b-1ad175929d71
    node scripts/generate-outlook-workflow.js --tenantId=test-tenant-001 --credentialId=xyz789

  Pre-requis:
    - Le tenant doit exister dans Supabase
    - Les variables d'env N8N_API_URL et N8N_API_KEY doivent etre configurees
    - Le template UniqueWorkflow/Email Parser - Outlook.json doit exister
  `);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.tenantId) {
    console.error('❌ Le parametre --tenantId est requis.');
    console.error('   Exemple: node scripts/generate-outlook-workflow.js --tenantId=mon-tenant-001');
    console.error('   Utilisez --help pour plus d\'informations.');
    process.exit(1);
  }

  const { tenantId, credentialId } = options;

  console.log('');
  console.log('========================================');
  console.log('  Generate Outlook Email Parser Workflow');
  console.log('========================================');
  console.log(`  Tenant ID:      ${tenantId}`);
  console.log(`  Credential ID:  ${credentialId || '(auto depuis Supabase)'}`);
  console.log('');

  try {
    // Si pas de credentialId fourni, essayer de le recuperer depuis Supabase
    let finalCredentialId = credentialId;
    if (!finalCredentialId) {
      const supabaseService = require('../services/supabaseService');
      const { data: tenant } = await supabaseService.supabase
        .from('tenants')
        .select('outlook_credential_id')
        .eq('tenant_id', tenantId)
        .single();

      if (tenant?.outlook_credential_id) {
        finalCredentialId = tenant.outlook_credential_id;
        console.log(`📎 Credential Outlook recupere depuis Supabase: ${finalCredentialId}`);
      } else {
        console.log('⚠️  Aucun credential Outlook trouve. Le workflow sera cree sans credential.');
      }
    }

    const result = await workflowService.createOutlookEmailParserWorkflow(tenantId, finalCredentialId);

    console.log('');
    console.log('========================================');
    if (result.created) {
      console.log('✅ Workflow cree avec succes !');
      console.log(`   Workflow ID: ${result.workflowId}`);
      console.log(`   Project ID:  ${result.projectId || 'N/A'}`);
      console.log(`   Provider:    ${result.provider}`);
    } else {
      console.log('⚠️  Le workflow existe deja pour ce tenant.');
      console.log(`   Workflow ID: ${result.workflowId}`);
    }
    console.log('========================================');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Erreur:', error.message);
    console.error('');
    process.exit(1);
  }
}

main();
