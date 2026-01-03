const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauthController');

// Gmail OAuth
router.get('/gmail/connect', oauthController.getGmailAuthUrl);
router.get('/gmail/callback', oauthController.handleGmailCallback);

// Outlook OAuth (à implémenter après)
// router.get('/outlook/connect', oauthController.getOutlookAuthUrl);
// router.get('/outlook/callback', oauthController.handleOutlookCallback);

module.exports = router;