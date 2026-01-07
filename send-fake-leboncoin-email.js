require('dotenv').config();
const nodemailer = require('nodemailer');

/**
 * Script pour envoyer un faux email Leboncoin réaliste
 * vers votre Gmail pour tester le workflow
 */

// Configuration Gmail pour envoyer l'email
// Vous devez créer un "App Password" dans votre compte Google
// https://myaccount.google.com/apppasswords

const GMAIL_USER = process.env.TEST_GMAIL_USER || 'votre-email@gmail.com';
const GMAIL_APP_PASSWORD = process.env.TEST_GMAIL_APP_PASSWORD || 'votre-app-password';
const DESTINATION_EMAIL = process.env.WORKFLOW_GMAIL || 'email-du-workflow@gmail.com';

const leboncoinEmailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Nouveau message - leboncoin</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333; background-color: #f5f5f5; padding: 20px;">

  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background-color: #ff6e14; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">leboncoin</h1>
    </div>

    <!-- Content -->
    <div style="padding: 30px;">

      <h2 style="color: #ff6e14; font-size: 20px; margin-bottom: 20px;">
        Vous avez reçu un nouveau message
      </h2>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        Bonjour,
      </p>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        <strong>Jean Dupont</strong> vous a envoyé un message concernant votre annonce :
      </p>

      <!-- Annonce Card -->
      <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #fafafa;">
        <p style="margin: 0; font-size: 14px; color: #666;">
          <strong>Annonce :</strong> Appartement - Montpellier
        </p>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
          <strong>Référence :</strong> 2547893012
        </p>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
          <strong>Prix :</strong> 385 000 €
        </p>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
          <strong>Localisation :</strong> Montpellier 34000
        </p>
      </div>

      <!-- Message -->
      <div style="background-color: #f0f7ff; border-left: 4px solid #ff6e14; padding: 15px; margin-bottom: 20px;">
        <p style="font-size: 14px; line-height: 1.6; margin: 0;">
          Bonjour,<br><br>
          Je suis très intéressé par votre appartement
          Serait-il possible d'organiser une visite cette semaine ? Je suis disponible en fin d'après-midi.<br><br>
          Je recherche un bien pour y habiter avec ma famille.<br><br>
          Cordialement,<br>
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.leboncoin.fr/messages"
           style="display: inline-block; background-color: #ff6e14; color: white; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; font-size: 16px;">
          Répondre sur leboncoin
        </a>
      </div>

      <!-- Contact Info -->
      <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
        <p style="font-size: 12px; color: #666; margin: 5px 0;">
          <strong>Coordonnées de l'acheteur :</strong>
        </p>
        <p style="font-size: 12px; color: #666; margin: 5px 0;">
          Nom : Jean Dupont
        </p>
        <p style="font-size: 12px; color: #666; margin: 5px 0;">
          Téléphone : 06 12 34 56 78
        </p>
        <p style="font-size: 12px; color: #666; margin: 5px 0;">
          Email : jean.dupont@gmail.com
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 5px 0;">
        Cet email a été envoyé par leboncoin
      </p>
      <p style="margin: 5px 0;">
        © 2025 leboncoin - Tous droits réservés
      </p>
      <p style="margin: 10px 0 0 0;">
        <a href="https://www.leboncoin.fr" style="color: #ff6e14; text-decoration: none;">www.leboncoin.fr</a>
      </p>
    </div>

  </div>

</body>
</html>
`;

const leboncoinEmailText = `Nouveau message pour votre annonce "Appartement  - Montpellier"

Vous avez reçu un nouveau message

Bonjour,

Jean Dupont vous a envoyé un message concernant votre annonce :

Annonce : Appartement  - Montpellier
Référence : VA109
Prix : 385 000 €
Localisation : Montpellier 34000

--- Message ---
Bonjour,

Je suis très intéressé par votre appartement.
Serait-il possible d'organiser une visite cette semaine ? Je suis disponible en fin d'après-midi.

Je recherche un bien pour y habiter avec ma famille.

Cordialement,
--------------

Coordonnées de l'acheteur :
Nom : Jean Dupont
Téléphone : 06 12 34 56 78
Email : jean.dupont@gmail.com

Répondre sur leboncoin : https://www.leboncoin.fr/messages

© 2025 leboncoin - www.leboncoin.fr`;

async function sendFakeLeboncoinEmail() {
  console.log('📧 Envoi d\'un faux email Leboncoin...\n');

  if (GMAIL_USER === 'votre-email@gmail.com' || GMAIL_APP_PASSWORD === 'votre-app-password') {
    console.error('❌ Erreur: Vous devez configurer vos identifiants Gmail\n');
    console.log('🔧 Configuration requise:');
    console.log('   1. Ajoutez dans votre .env:');
    console.log('      TEST_GMAIL_USER=votre-email@gmail.com');
    console.log('      TEST_GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx');
    console.log('      WORKFLOW_GMAIL=email-connecte-au-workflow@gmail.com\n');
    console.log('   2. Créez un "App Password" Google:');
    console.log('      https://myaccount.google.com/apppasswords\n');
    process.exit(1);
  }

  // Créer le transporteur nodemailer
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD
    }
  });

  // Configuration de l'email
  const mailOptions = {
    from: {
      name: 'Leboncoin Messagerie',
      address: GMAIL_USER // Gmail ne permet pas de spoofer le FROM, on utilise notre email
    },
    to: DESTINATION_EMAIL,
    subject: 'Nouveau message pour votre annonce "Appartement T3 - Paris 15ème"',
    text: leboncoinEmailText,
    html: leboncoinEmailHTML,
    // Headers pour ressembler à Leboncoin
    headers: {
      'X-Leboncoin-Test': 'true',
      'Reply-To': 'noreply@messagerie.leboncoin.fr'
    }
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email envoyé avec succès!\n');
    console.log('📋 Détails:');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   From: Leboncoin Messagerie <${GMAIL_USER}>`);
    console.log(`   To: ${DESTINATION_EMAIL}`);
    console.log(`   Subject: Nouveau message pour votre annonce "Appartement T3 - Paris 15ème"\n`);

    console.log('⏱️  Prochaines étapes:');
    console.log('   1. Attendez 1-2 minutes que l\'email arrive');
    console.log('   2. Ouvrez n8n: https://n8n.emkai.fr/workflow/fUa1c3Cz0c6QQM1e');
    console.log('   3. Cliquez sur "Gmail Trigger" → "Fetch test event"');
    console.log('   4. Cliquez sur "Test workflow"\n');

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi:', error.message);

    if (error.message.includes('Invalid login')) {
      console.log('\n💡 Solution:');
      console.log('   Activez l\'accès "Applications moins sécurisées" ou utilisez un App Password');
      console.log('   https://myaccount.google.com/apppasswords');
    }
  }
}

// Vérifier si nodemailer est installé
try {
  require.resolve('nodemailer');
  sendFakeLeboncoinEmail();
} catch (e) {
  console.error('❌ Module "nodemailer" non trouvé\n');
  console.log('📦 Installation requise:');
  console.log('   npm install nodemailer\n');
  process.exit(1);
}
