require('dotenv').config();

module.exports = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/gmail/callback',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://mail.google.com/'
    ]
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/auth/outlook/callback',
    scopes: [
      'https://outlook.office.com/IMAP.AccessAsUser.All',
      'offline_access'
    ]
  }
};