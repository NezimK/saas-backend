/**
 * Template email Leboncoin
 * Basé sur le format réel des notifications de contact Leboncoin
 */

const BRAND_COLOR = '#FF6E14';
const BRAND_NAME = 'leboncoin';

function getSubject(data) {
  return `Nouveau message pour votre annonce "${data.property.title}"`;
}

function getSenderName() {
  return 'Leboncoin Messagerie';
}

function getSenderDomain() {
  return 'leboncoin.fr';
}

function getReplyTo() {
  return 'noreply@messagerie.leboncoin.fr';
}

function getHTML(data) {
  const { prospect, property } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Nouveau message - leboncoin</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333; background-color: #f5f5f5; padding: 20px;">

  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background-color: ${BRAND_COLOR}; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">${BRAND_NAME}</h1>
    </div>

    <!-- Content -->
    <div style="padding: 30px;">

      <h2 style="color: ${BRAND_COLOR}; font-size: 20px; margin-bottom: 20px;">
        Vous avez reçu un nouveau message
      </h2>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        Bonjour,
      </p>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        <strong>${prospect.firstName} ${prospect.lastName}</strong> vous a envoyé un message concernant votre annonce :
      </p>

      <!-- Annonce Card -->
      <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #fafafa;">
        <p style="margin: 0; font-size: 14px; color: #666;">
          <strong>Annonce :</strong> ${property.title}
        </p>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
          <strong>Référence : ${property.reference}</strong>
        </p>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
          <strong>Prix :</strong> ${property.price}
        </p>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
          <strong>Localisation :</strong> ${property.location}
        </p>
      </div>

      <!-- Message -->
      <div style="background-color: #f0f7ff; border-left: 4px solid ${BRAND_COLOR}; padding: 15px; margin-bottom: 20px;">
        <p style="font-size: 14px; line-height: 1.6; margin: 0;">
          ${prospect.message.replace(/\n/g, '<br>')}
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.leboncoin.fr/messages"
           style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; font-size: 16px;">
          Répondre sur leboncoin
        </a>
      </div>

      <!-- Contact Info -->
      <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
        <p style="font-size: 12px; color: #666; margin: 5px 0;">
          <strong>Coordonnées de l'acheteur :</strong>
        </p>
        <p style="font-size: 12px; color: #666; margin: 5px 0;">
          Nom : ${prospect.firstName} ${prospect.lastName}
        </p>
        <p style="font-size: 12px; color: #666; margin: 5px 0;">
          Téléphone : ${prospect.phone}
        </p>
        <p style="font-size: 12px; color: #666; margin: 5px 0;">
          Email : ${prospect.email}
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
        <a href="https://www.leboncoin.fr" style="color: ${BRAND_COLOR}; text-decoration: none;">www.leboncoin.fr</a>
      </p>
    </div>

  </div>

</body>
</html>`;
}

function getText(data) {
  const { prospect, property } = data;

  return `Nouveau message pour votre annonce "${property.title}"

Vous avez reçu un nouveau message

Bonjour,

${prospect.firstName} ${prospect.lastName} vous a envoyé un message concernant votre annonce :

Annonce : ${property.title}
Référence : ${property.reference}
Prix : ${property.price}
Localisation : ${property.location}

--- Message ---
${prospect.message}
--------------

Coordonnées de l'acheteur :
Nom : ${prospect.firstName} ${prospect.lastName}
Téléphone : ${prospect.phone}
Email : ${prospect.email}

Répondre sur leboncoin : https://www.leboncoin.fr/messages

© 2025 leboncoin - www.leboncoin.fr`;
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
