/**
 * Template email Ouest-France Immo
 * Format estimé basé sur les conventions des portails immobiliers français
 */

const BRAND_COLOR = '#C4161C';
const BRAND_NAME = 'Ouest-France Immo';

function getSubject(data) {
  return `Contact pour votre annonce immobilière`;
}

function getSenderName() {
  return 'Ouest-France Immo';
}

function getSenderDomain() {
  return 'ouestfrance-immo.com';
}

function getReplyTo() {
  return 'noreply@ouestfrance-immo.com';
}

function getHTML(data) {
  const { prospect, property } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Demande de contact - Ouest-France Immo</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333; background-color: #f5f5f5; padding: 20px;">

  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background-color: ${BRAND_COLOR}; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">
        <span style="font-weight: normal;">Ouest-France</span> <strong>Immo</strong>
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">Le N°1 des petites annonces immobilières dans l'Ouest</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px;">

      <h2 style="color: ${BRAND_COLOR}; font-size: 20px; margin-bottom: 20px;">
        Demande de contact
      </h2>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        Bonjour,
      </p>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 25px;">
        Un internaute a exprimé son intérêt pour l'un de vos biens sur Ouest-France Immo.
      </p>

      <!-- Annonce Card -->
      <div style="border-left: 4px solid ${BRAND_COLOR}; padding: 15px 20px; margin-bottom: 25px; background-color: #fef5f5;">
        <p style="font-size: 12px; color: ${BRAND_COLOR}; margin: 0 0 10px 0; font-weight: bold; text-transform: uppercase;">
          Détails de l'annonce
        </p>
        <p style="font-size: 16px; font-weight: bold; color: #333; margin: 0 0 15px 0;">
          ${property.title}
        </p>
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 5px 0; color: #666; width: 110px;">Référence</td>
            <td style="padding: 5px 0; color: #333;">${property.reference}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666;">Type</td>
            <td style="padding: 5px 0; color: #333;">${property.type}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666;">Prix</td>
            <td style="padding: 5px 0; color: ${BRAND_COLOR}; font-weight: bold;">${property.price}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666;">Localisation</td>
            <td style="padding: 5px 0; color: #333;">${property.location}</td>
          </tr>
        </table>
      </div>

      <!-- Prospect Info -->
      <div style="background-color: #f8f8f8; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
        <p style="font-size: 12px; color: #666; margin: 0 0 15px 0; font-weight: bold; text-transform: uppercase;">
          Informations du prospect
        </p>
        <p style="margin: 0 0 10px 0; font-size: 15px; color: #333;">
          <strong>${prospect.firstName} ${prospect.lastName}</strong>
        </p>
        <p style="margin: 0 0 5px 0; font-size: 14px; color: #555;">
          Tél : ${prospect.phone}
        </p>
        <p style="margin: 0; font-size: 14px; color: #555;">
          Email : ${prospect.email}
        </p>
      </div>

      <!-- Message -->
      <div style="margin-bottom: 25px;">
        <p style="font-size: 12px; color: #666; margin: 0 0 10px 0; font-weight: bold; text-transform: uppercase;">
          Message
        </p>
        <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
          <p style="font-size: 14px; line-height: 1.7; margin: 0; color: #333;">
            ${prospect.message.replace(/\n/g, '<br>')}
          </p>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://ouestfrance.immo/pro"
           style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; padding: 14px 30px; border-radius: 4px; font-weight: bold; font-size: 15px;">
          Répondre au prospect
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 5px 0;">
        Ce message a été envoyé automatiquement par Ouest-France Immo.
      </p>
      <p style="margin: 5px 0;">
        © 2025 Groupe Ouest-France - Tous droits réservés
      </p>
      <p style="margin: 10px 0 0 0;">
        <a href="https://ouestfrance.immo" style="color: ${BRAND_COLOR}; text-decoration: none;">ouestfrance.immo</a>
      </p>
    </div>

  </div>

</body>
</html>`;
}

function getText(data) {
  const { prospect, property } = data;

  return `Contact pour votre annonce immobilière

OUEST-FRANCE IMMO
Le N°1 des petites annonces immobilières dans l'Ouest

Demande de contact

Bonjour,

Un internaute a exprimé son intérêt pour l'un de vos biens sur Ouest-France Immo.

DÉTAILS DE L'ANNONCE
--------------------
${property.title}
Référence : ${property.reference}
Type : ${property.type}
Prix : ${property.price}
Localisation : ${property.location}

INFORMATIONS DU PROSPECT
------------------------
${prospect.firstName} ${prospect.lastName}
Tél : ${prospect.phone}
Email : ${prospect.email}

MESSAGE
-------
${prospect.message}

---

Répondre au prospect : https://ouestfrance.immo/pro

© 2025 Groupe Ouest-France - ouestfrance.immo`;
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
