const express = require('express');
const router = express.Router();
const { getAllCampaigns, getCampaignStats } = require('../services/campaignService');
const geminiAgent = require('../services/geminiService');

// GET /api/campaigns
router.get('/', async (req, res) => {
  try {
    const campaigns = await getAllCampaigns();
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id/stats
router.get('/:id/stats', async (req, res) => {
  try {
    const stats = await getCampaignStats(req.params.id);
    if (!stats) return res.status(404).json({ error: 'Campaign not found' });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id/insights
router.get('/:id/insights', async (req, res) => {
  try {
    const stats = await getCampaignStats(req.params.id);
    if (!stats) return res.status(404).json({ error: 'Campaign not found' });
    if (stats.status !== 'completed') {
      return res.status(400).json({ error: 'Campaign not completed yet' });
    }
    const insights = await geminiAgent.generateInsights(stats);
    res.json({ insights, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;