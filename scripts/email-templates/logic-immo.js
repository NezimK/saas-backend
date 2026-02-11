/**
 * Template email Logic-Immo
 * Format estimé basé sur les conventions des portails immobiliers français
 */

const BRAND_COLOR = '#00A651';
const BRAND_NAME = 'Logic-Immo';

function getSubject(data) {
  return `Un internaute souhaite vous contacter - ${data.property.type}`;
}

function getSenderName() {
  return 'Logic-Immo';
}

function getSenderDomain() {
  return 'logic-immo.com';
}

function getReplyTo() {
  return 'noreply@logic-immo.com';
}

function getHTML(data) {
  const { prospect, property } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Demande de contact - Logic-Immo</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333; background-color: #f5f5f5; padding: 20px;">

  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background-color: ${BRAND_COLOR}; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">${BRAND_NAME}</h1>
      <p style="color: white; margin: 5px 0 0 0; font-size: 12px;">Trouvez votre bien immobilier</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px;">

      <h2 style="color: ${BRAND_COLOR}; font-size: 20px; margin-bottom: 20px;">
        Demande de contact
      </h2>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        Bonjour,
      </p>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        Un internaute a consulté votre annonce sur Logic-Immo et souhaite vous contacter.
      </p>

      <!-- Annonce Card -->
      <div style="border-left: 4px solid ${BRAND_COLOR}; padding: 15px; margin-bottom: 20px; background-color: #f0fff5;">
        <p style="font-size: 16px; font-weight: bold; color: #333; margin: 0 0 10px 0;">
          Annonce concernée
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #333;">
          <strong>${property.title}</strong>
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          Référence : ${property.reference}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          Type de bien : ${property.type}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          Prix : ${property.price}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          Localisation : ${property.location}
        </p>
      </div>

      <!-- Prospect Info -->
      <div style="background-color: #fafafa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <p style="font-size: 14px; font-weight: bold; color: ${BRAND_COLOR}; margin: 0 0 15px 0;">
          Informations du prospect
        </p>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Prénom</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333; font-weight: bold;">${prospect.firstName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Nom</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333; font-weight: bold;">${prospect.lastName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Téléphone</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333; font-weight: bold;">${prospect.phone}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Email</td>
            <td style="padding: 8px 0; color: #333; font-weight: bold;">${prospect.email}</td>
          </tr>
        </table>
      </div>

      <!-- Message -->
      <div style="margin-bottom: 20px;">
        <p style="font-size: 14px; font-weight: bold; color: #333; margin: 0 0 10px 0;">
          Message :
        </p>
        <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 15px;">
          <p style="font-size: 14px; line-height: 1.6; margin: 0; color: #333;">
            ${prospect.message.replace(/\n/g, '<br>')}
          </p>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.logic-immo.com/pro"
           style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; font-size: 16px;">
          Accéder à mon espace pro
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 5px 0;">
        Ce message a été envoyé automatiquement par Logic-Immo.
      </p>
      <p style="margin: 5px 0;">
        © 2025 Logic-Immo - Digital Classifieds France
      </p>
      <p style="margin: 10px 0 0 0;">
        <a href="https://www.logic-immo.com" style="color: ${BRAND_COLOR}; text-decoration: none;">www.logic-immo.com</a>
      </p>
    </div>

  </div>

</body>
</html>`;
}

function getText(data) {
  const { prospect, property } = data;

  return `Un internaute souhaite vous contacter - ${property.type}

LOGIC-IMMO
Trouvez votre bien immobilier

Demande de contact

Bonjour,

Un internaute a consulté votre annonce sur Logic-Immo et souhaite vous contacter.

ANNONCE CONCERNÉE
-----------------
${property.title}
Référence : ${property.reference}
Type de bien : ${property.type}
Prix : ${property.price}
Localisation : ${property.location}

INFORMATIONS DU PROSPECT
------------------------
Prénom : ${prospect.firstName}
Nom : ${prospect.lastName}
Téléphone : ${prospect.phone}
Email : ${prospect.email}

MESSAGE
-------
${prospect.message}

---

Accéder à mon espace pro : https://www.logic-immo.com/pro

© 2025 Logic-Immo - Digital Classifieds France - www.logic-immo.com`;
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
