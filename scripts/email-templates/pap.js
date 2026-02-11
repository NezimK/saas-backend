/**
 * Template email PAP (Particulier à Particulier)
 * Format estimé basé sur les conventions des portails immobiliers français
 */

const BRAND_COLOR = '#0066CC';
const BRAND_NAME = 'PAP';

function getSubject(data) {
  return `Nouveau contact pour votre annonce n°${data.property.reference}`;
}

function getSenderName() {
  return 'PAP.fr';
}

function getSenderDomain() {
  return 'pap.fr';
}

function getReplyTo() {
  return 'noreply@pap.fr';
}

function getHTML(data) {
  const { prospect, property } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Nouveau contact - PAP</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333; background-color: #f5f5f5; padding: 20px;">

  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background-color: ${BRAND_COLOR}; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">${BRAND_NAME}</h1>
      <p style="color: white; margin: 5px 0 0 0; font-size: 12px;">De Particulier à Particulier</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px;">

      <h2 style="color: ${BRAND_COLOR}; font-size: 20px; margin-bottom: 20px;">
        Un particulier vous contacte
      </h2>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        Bonjour,
      </p>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        Vous avez reçu une demande de contact concernant votre annonce sur PAP.fr.
      </p>

      <!-- Annonce Card -->
      <div style="border: 2px solid ${BRAND_COLOR}; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #f0f7ff;">
        <p style="font-size: 16px; font-weight: bold; color: ${BRAND_COLOR}; margin: 0 0 10px 0;">
          Annonce n°${property.reference}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #333;">
          ${property.title}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          <strong>Prix :</strong> ${property.price}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          <strong>Localisation :</strong> ${property.location}
        </p>
      </div>

      <!-- Prospect Info -->
      <div style="background-color: #fafafa; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <p style="font-size: 14px; font-weight: bold; color: #333; margin: 0 0 10px 0;">
          Coordonnées de l'acheteur potentiel :
        </p>
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 5px 0; color: #666; width: 100px;">Nom</td>
            <td style="padding: 5px 0; color: #333;"><strong>${prospect.firstName} ${prospect.lastName}</strong></td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666;">Téléphone</td>
            <td style="padding: 5px 0; color: #333;"><strong>${prospect.phone}</strong></td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666;">Email</td>
            <td style="padding: 5px 0; color: #333;"><strong>${prospect.email}</strong></td>
          </tr>
        </table>
      </div>

      <!-- Message -->
      <div style="margin-bottom: 20px;">
        <p style="font-size: 14px; font-weight: bold; color: #333; margin: 0 0 10px 0;">
          Son message :
        </p>
        <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 15px;">
          <p style="font-size: 14px; line-height: 1.6; margin: 0; color: #333;">
            ${prospect.message.replace(/\n/g, '<br>')}
          </p>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.pap.fr/messagerie"
           style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; font-size: 16px;">
          Voir sur PAP.fr
        </a>
      </div>

      <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
        Nous vous conseillons de répondre rapidement pour maximiser vos chances de conclure.
      </p>

    </div>

    <!-- Footer -->
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 5px 0;">
        Ce message a été envoyé automatiquement par PAP.fr
      </p>
      <p style="margin: 5px 0;">
        © 2025 PAP - De Particulier à Particulier
      </p>
      <p style="margin: 10px 0 0 0;">
        <a href="https://www.pap.fr" style="color: ${BRAND_COLOR}; text-decoration: none;">www.pap.fr</a>
      </p>
    </div>

  </div>

</body>
</html>`;
}

function getText(data) {
  const { prospect, property } = data;

  return `Nouveau contact pour votre annonce n°${property.reference}

PAP - De Particulier à Particulier

Un particulier vous contacte

Bonjour,

Vous avez reçu une demande de contact concernant votre annonce sur PAP.fr.

ANNONCE N°${property.reference}
--------------------
${property.title}
Prix : ${property.price}
Localisation : ${property.location}

COORDONNÉES DE L'ACHETEUR POTENTIEL
-----------------------------------
Nom : ${prospect.firstName} ${prospect.lastName}
Téléphone : ${prospect.phone}
Email : ${prospect.email}

SON MESSAGE
-----------
${prospect.message}

---

Voir sur PAP.fr : https://www.pap.fr/messagerie

Nous vous conseillons de répondre rapidement pour maximiser vos chances de conclure.

© 2025 PAP - www.pap.fr`;
}

module.exports = {
  getSubject,
  getSenderName,
  getSenderDomain,
  getReplyTo,
  getHTML,
  getText,
  BRAND_COLOR,
  BRAND_NAME
};
