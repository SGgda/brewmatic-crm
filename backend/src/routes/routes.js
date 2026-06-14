const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const geminiAgent = require('../services/geminiService');
const { createSegment } = require('../services/segmentService');
const { createCampaign, launchCampaign } = require('../services/campaignService');

// POST /api/agent/chat
router.post('/chat', async (req, res) => {
  const { session_id, message } = req.body;

  if (!session_id || !message) {
    return res.status(400).json({ 
      error: 'session_id and message are required' 
    });
  }

  try {
    // Load conversation history for this session
    const historyResult = await pool.query(
      `SELECT role, content FROM agent_conversations 
       WHERE session_id = $1 ORDER BY created_at ASC`,
      [session_id]
    );
    const history = historyResult.rows;

    // Save user message
    await pool.query(
      `INSERT INTO agent_conversations (session_id, role, content) 
       VALUES ($1, 'user', $2)`,
      [session_id, message]
    );

    // Call Gemini
    const { text, action } = await geminiAgent.chat(history, message);

    let metadata = {};

    // Execute action if present
    if (action && action.type === 'CREATE_SEGMENT_AND_CAMPAIGN') {
      try {
        // Step 1: Create segment
        const { segment, customers } = await createSegment({
          name: action.segment.name,
          description: action.segment.description,
          filters: action.segment.filters
        });

        // Step 2: Create campaign
        const campaign = await createCampaign({
          name: action.campaign.name,
          goal: action.campaign.goal,
          segmentId: segment.id,
          message: action.campaign.message,
          channel: action.campaign.channel,
          predictedOpenRate: action.prediction?.estimated_open_rate,
          predictedConversions: action.prediction?.estimated_conversions,
          createdBy: 'ai'
        });

        // Step 3: Launch
        const dispatched = await launchCampaign(campaign.id, customers);

        metadata = {
          action_executed: true,
          segment_id: segment.id,
          campaign_id: campaign.id,
          customers_reached: dispatched,
          segment_name: segment.name,
          campaign_name: campaign.name
        };

      } catch (actionErr) {
        console.error('Action execution failed:', actionErr.message);
        metadata = { action_executed: false, error: actionErr.message };
      }
    }

    // Save assistant response
    await pool.query(
      `INSERT INTO agent_conversations 
        (session_id, role, content, metadata) 
       VALUES ($1, 'assistant', $2, $3)`,
      [session_id, text, JSON.stringify(metadata)]
    );

    res.json({ reply: text, metadata, session_id });

  } catch (err) {
    console.error('Agent chat error:', err.message);
    res.status(500).json({ error: 'Agent error', details: err.message });
  }
});

// GET /api/agent/history/:sessionId
router.get('/history/:sessionId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT role, content, metadata, created_at 
       FROM agent_conversations 
       WHERE session_id = $1 ORDER BY created_at ASC`,
      [req.params.sessionId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;