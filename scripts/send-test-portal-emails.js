#!/usr/bin/env node
require('dotenv').config();
const nodemailer = require('nodemailer');
const { getTemplate, getAvailablePortals, generateEmailData, DEFAULT_TEST_DATA } = require('./email-templates');

/**
 * Script CLI pour envoyer des emails de test simulant les notifications
 * des différents portails immobiliers français.
 *
 * Usage:
 *   node scripts/send-test-portal-emails.js --portal=seloger --to=email@example.com
 *   node scripts/send-test-portal-emails.js --portal=all --to=email@example.com
 *   node scripts/send-test-portal-emails.js --portal=leboncoin --to=email@example.com --ref=VA002
 */

// Configuration Gmail pour l'envoi
const GMAIL_USER = process.env.TEST_GMAIL_USER || 'votre-email@gmail.com';
const GMAIL_APP_PASSWORD = process.env.TEST_GMAIL_APP_PASSWORD || 'votre-app-password';

// Parser les arguments de ligne de commande
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    portal: null,
    to: [],
    ref: null,
    delay: 0, // Délai en secondes entre chaque envoi
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--portal=')) {
      options.portal = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--to=')) {
      options.to = arg.split('=')[1].split(',').map(e => e.trim());
    } else if (arg.startsWith('--ref=')) {
      options.ref = arg.split('=')[1];
    } else if (arg.startsWith('--delay=')) {
      options.delay = parseInt(arg.split('=')[1], 10) || 0;
    } else if (!arg.startsWith('--')) {
      // Argument positionnel = adresse email
      options.to.push(arg);
    }
  }

  return options;
}

// Afficher l'aide
function showHelp() {
  const portals = getAvailablePortals();

  console.log(`
📧 Script d'envoi d'emails de test - Portails immobiliers

USAGE:
  node scripts/send-test-portal-emails.js [options] [emails...]

OPTIONS:
  --portal=<nom>    Portail à simuler (obligatoire)
                    Valeurs: ${portals.join(', ')}, all

  --to=<emails>     Adresse(s) email destinataire(s), séparées par des virgules

  --ref=<ref>       Référence du bien (optionnel, défaut: VA001)

  --delay=<sec>     Délai en secondes entre chaque envoi (pour les tests n8n)
                    Recommandé: 65 secondes pour laisser le workflow traiter chaque email

  --help, -h        Affiche cette aide

EXEMPLES:
  # Envoyer un email SeLoger
  node scripts/send-test-portal-emails.js --portal=seloger --to=test@gmail.com

  # Envoyer tous les portails
  node scripts/send-test-portal-emails.js --portal=all --to=test@gmail.com

  # Envoyer tous les portails avec délai (pour test n8n)
  node scripts/send-test-portal-emails.js --portal=all --to=test@gmail.com --delay=65

  # Avec une référence personnalisée
  node scripts/send-test-portal-emails.js --portal=leboncoin --to=test@gmail.com --ref=VA002

  # Plusieurs destinataires
  node scripts/send-test-portal-emails.js --portal=pap --to=email1@gmail.com,email2@gmail.com

PORTAILS DISPONIBLES:
${portals.map(p => `  • ${p}`).join('\n')}

CONFIGURATION:
  Définir dans .env:
    TEST_GMAIL_USER=votre-email@gmail.com
    TEST_GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

  Créer un App Password Google: https://myaccount.google.com/apppasswords
`);
}

// Créer le transporteur nodemailer
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD
    }
  });
}

// Envoyer un email pour un portail spécifique
async function sendPortalEmail(transporter, portalName, recipients, customData = {}) {
  try {
    const emailData = generateEmailData(portalName, customData);

    const mailOptions = {
      from: {
        name: emailData.senderName,
        address: GMAIL_USER
      },
      to: recipients.join(', '),
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html,
      headers: {
        [`X-${emailData.brandName.replace(/[^a-zA-Z]/g, '')}-Test`]: 'true',
        'Reply-To': emailData.replyTo
      }
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      portal: portalName,
      messageId: info.messageId,
      subject: emailData.subject
    };
  } catch (error) {
    return {
      success: false,
      portal: portalName,
      error: error.message
    };
  }
}

// Fonction principale
async function main() {
  const options = parseArgs();

  // Afficher l'aide si demandée
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Vérifier les paramètres requis
  if (!options.portal) {
    console.error('❌ Erreur: Le paramètre --portal est obligatoire\n');
    showHelp();
    process.exit(1);
  }

  if (options.to.length === 0) {
    console.error('❌ Erreur: Au moins une adresse email est requise (--to=email@example.com)\n');
    showHelp();
    process.exit(1);
  }

  // Vérifier la configuration Gmail
  if (GMAIL_USER === 'votre-email@gmail.com' || GMAIL_APP_PASSWORD === 'votre-app-password') {
    console.error('❌ Erreur: Configuration Gmail manquante\n');
    console.log('🔧 Ajoutez dans votre .env:');
    console.log('   TEST_GMAIL_USER=votre-email@gmail.com');
    console.log('   TEST_GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx\n');
    console.log('📖 Créer un App Password: https://myaccount.google.com/apppasswords\n');
    process.exit(1);
  }

  // Déterminer les portails à envoyer
  const availablePortals = getAvailablePortals();
  let portalsToSend = [];

  if (options.portal === 'all') {
    portalsToSend = availablePortals;
  } else if (availablePortals.includes(options.portal)) {
    portalsToSend = [options.portal];
  } else {
    console.error(`❌ Erreur: Portail inconnu "${options.portal}"\n`);
    console.log(`Portails disponibles: ${availablePortals.join(', ')}, all\n`);
    process.exit(1);
  }

  // Préparer les données personnalisées
  const customData = {};
  if (options.ref) {
    customData.property = { reference: options.ref };
  }

  console.log('📧 Envoi d\'emails de test - Portails immobiliers\n');
  console.log(`📬 Destinataire(s): ${options.to.join(', ')}`);
  console.log(`📋 Portail(s): ${portalsToSend.join(', ')}`);
  if (options.ref) {
    console.log(`🏠 Référence: ${options.ref}`);
  }
  if (options.delay > 0) {
    console.log(`⏱️  Délai entre envois: ${options.delay} secondes`);
    const totalTime = (portalsToSend.length - 1) * options.delay;
    console.log(`⏳ Durée totale estimée: ${Math.floor(totalTime / 60)}min ${totalTime % 60}s`);
  }
  console.log('');

  // Créer le transporteur
  const transporter = createTransporter();

  // Envoyer les emails
  const results = [];
  for (let i = 0; i < portalsToSend.length; i++) {
    const portal = portalsToSend[i];
    process.stdout.write(`  [${i + 1}/${portalsToSend.length}] Envoi ${portal}... `);
    const result = await sendPortalEmail(transporter, portal, options.to, customData);
    results.push(result);

    if (result.success) {
      console.log(`✅ OK`);
    } else {
      console.log(`❌ Erreur: ${result.error}`);
    }

    // Délai entre les envois
    if (i < portalsToSend.length - 1) {
      if (options.delay > 0) {
        process.stdout.write(`      ⏳ Attente ${options.delay}s avant le prochain envoi...`);
        await new Promise(resolve => setTimeout(resolve, options.delay * 1000));
        console.log(' OK');
      } else {
        // Petit délai par défaut pour éviter le rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // Résumé
  console.log('\n📊 Résumé:');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`   ✅ Réussis: ${successCount}`);
  if (failCount > 0) {
    console.log(`   ❌ Échecs: ${failCount}`);
  }

  // Prochaines étapes
  console.log('\n⏱️  Prochaines étapes:');
  console.log('   1. Attendez 1-2 minutes que les emails arrivent');
  console.log('   2. Ouvrez n8n et déclenchez le workflow Email Parser');
  console.log('   3. Vérifiez que les leads sont correctement créés dans Supabase');
  console.log('');

  // Retourner le code de sortie approprié
  process.exit(failCount > 0 ? 1 : 0);
}

// Exécuter
main().catch(error => {
  console.error('❌ Erreur fatale:', error.message);
  process.exit(1);
});
