/**
 * Template email Figaro Immo (ex-Explorimmo)
 * Format estimé basé sur les conventions des portails immobiliers français
 */

const BRAND_COLOR = '#0053A0';
const BRAND_NAME = 'Figaro Immo';

function getSubject(data) {
  return `Nouveau contact pour votre annonce ${data.property.reference}`;
}

function getSenderName() {
  return 'Figaro Immo';
}

function getSenderDomain() {
  return 'figaroimmo.fr';
}

function getReplyTo() {
  return 'noreply@figaroimmo.fr';
}

function getHTML(data) {
  const { prospect, property } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Demande de contact - Figaro Immo</title>
</head>
<body style="font-family: 'Georgia', serif; color: #333; background-color: #f5f5f5; padding: 20px;">

  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background-color: ${BRAND_COLOR}; padding: 20px; text-align: center; border-bottom: 4px solid #003366;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-family: 'Georgia', serif; font-weight: normal;">
        <span style="font-style: italic;">Le</span> ${BRAND_NAME}
      </h1>
    </div>

    <!-- Content -->
    <div style="padding: 30px; font-family: Arial, sans-serif;">

      <h2 style="color: ${BRAND_COLOR}; font-size: 18px; margin-bottom: 20px; font-family: 'Georgia', serif; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        Demande de contact
      </h2>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        Bonjour,
      </p>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 25px;">
        Un internaute a manifesté son intérêt pour l'un de vos biens sur Figaro Immo.
      </p>

      <!-- Annonce Card -->
      <div style="border: 1px solid #ddd; border-left: 4px solid ${BRAND_COLOR}; padding: 20px; margin-bottom: 25px; background-color: #fafafa;">
        <p style="font-size: 12px; color: #999; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">
          Détails de l'annonce
        </p>
        <p style="font-size: 16px; font-weight: bold; color: #333; margin: 0 0 15px 0;">
          ${property.title}
        </p>
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 5px 0; color: #666; width: 120px;">Référence</td>
            <td style="padding: 5px 0; color: #333;">${property.reference}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666;">Type de bien</td>
            <td style="padding: 5px 0; color: #333;">${property.type}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666;">Prix</td>
            <td style="padding: 5px 0; color: #333; font-weight: bold;">${property.price}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666;">Localisation</td>
            <td style="padding: 5px 0; color: #333;">${property.location}</td>
          </tr>
        </table>
      </div>

      <!-- Prospect Info -->
      <div style="background-color: #f0f5fa; border-radius: 4px; padding: 20px; margin-bottom: 25px;">
        <p style="font-size: 12px; color: ${BRAND_COLOR}; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;">
          Coordonnées du prospect
        </p>
        <p style="margin: 0 0 8px 0; font-size: 15px; color: #333;">
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
        <p style="font-size: 12px; color: #999; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">
          Message du prospect
        </p>
        <div style="background-color: #fff; border: 1px solid #ddd; padding: 15px; font-style: italic;">
          <p style="font-size: 14px; line-height: 1.6; margin: 0; color: #333;">
            "${prospect.message.replace(/\n/g, '<br>')}"
          </p>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://immobilier.lefigaro.fr/pro"
           style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; padding: 12px 30px; border-radius: 2px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
          Répondre
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #eee;">
      <p style="margin: 5px 0;">
        Ce message a été envoyé automatiquement par Figaro Immo.
      </p>
      <p style="margin: 5px 0;">
        © 2025 Groupe Figaro - Tous droits réservés
      </p>
      <p style="margin: 10px 0 0 0;">
        <a href="https://immobilier.lefigaro.fr" style="color: ${BRAND_COLOR}; text-decoration: none;">immobilier.lefigaro.fr</a>
      </p>
    </div>

  </div>

</body>
</html>`;
}

function getText(data) {
  const { prospect, property } = data;

  return `Nouveau contact pour votre annonce ${property.reference}

LE FIGARO IMMO

Demande de contact

Bonjour,

Un internaute a manifesté son intérêt pour l'un de vos biens sur Figaro Immo.

DÉTAILS DE L'ANNONCE
--------------------
${property.title}
Référence : ${property.reference}
Type de bien : ${property.type}
Prix : ${property.price}
Localisation : ${property.location}

COORDONNÉES DU PROSPECT
-----------------------
${prospect.firstName} ${prospect.lastName}
Tél : ${prospect.phone}
Email : ${prospect.email}

MESSAGE DU PROSPECT
-------------------
"${prospect.message}"

---

Répondre : https://immobilier.lefigaro.fr/pro

© 2025 Groupe Figaro - immobilier.lefigaro.fr`;
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
