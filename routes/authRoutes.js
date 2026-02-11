const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauthController');

// Gmail OAuth
router.get('/gmail/connect', (req, res) => oauthController.getGmailAuthUrl(req, res));
router.get('/gmail/callback', (req, res) => oauthController.handleGmailCallback(req, res));

// Outlook OAuth
router.get('/outlook/connect', (req, res) => oauthController.getOutlookAuthUrl(req, res));
router.get('/outlook/callback', (req, res) => oauthController.handleOutlookCallback(req, res));

module.exports = router;