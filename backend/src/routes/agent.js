const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const geminiAgent = require('../services/geminiService');
const { evaluateSegment, createSegment } = require('../services/segmentService');
const { createCampaign, launchCampaign } = require('../services/campaignService');

// Channel benchmarks - must match geminiService.js system prompt
const CHANNEL_BENCHMARKS = {
  whatsapp: { open_rate: 0.65, conversion_rate: 0.08 },
  sms: { open_rate: 0.45, conversion_rate: 0.05 },
  email: { open_rate: 0.28, conversion_rate: 0.04 },
  rcs: { open_rate: 0.55, conversion_rate: 0.07 }
};

function computeRealPrediction(customerCount, channel) {
  const benchmark = CHANNEL_BENCHMARKS[channel] || CHANNEL_BENCHMARKS.email;
  const estimatedOpens = Math.round(customerCount * benchmark.open_rate);
  const estimatedConversions = Math.round(customerCount * benchmark.conversion_rate);
  return {
    estimated_reach: customerCount,
    estimated_open_rate: benchmark.open_rate * 100,
    estimated_opens: estimatedOpens,
    estimated_conversions: estimatedConversions
  };
}

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

    let replyText = text;
    let metadata = {};

    // Execute action if present
    if (action && action.type === 'CREATE_SEGMENT_AND_CAMPAIGN') {
      try {
        // Step 1: Evaluate the segment filters FIRST to get real customer count
        const matchedCustomers = await evaluateSegment(action.segment.filters);
        const realReach = matchedCustomers.length;

        if (realReach === 0) {
          // No customers match — don't create segment/campaign, tell the marketer
          replyText = `${text}\n\n⚠️ Heads up — I checked the actual customer database, and **0 customers** currently match this segment's filters (${JSON.stringify(action.segment.filters)}). I didn't create the campaign since there's no one to send it to.\n\nWant me to widen the criteria — for example, increase the inactivity window or lower the spend threshold?`;

          metadata = {
            action_executed: false,
            reason: 'zero_reach',
            attempted_filters: action.segment.filters
          };

        } else {
          // Step 2: Compute REAL prediction from actual matched customers + channel benchmarks
          const realPrediction = computeRealPrediction(realReach, action.campaign.channel);

          // Step 3: Create segment (re-uses evaluateSegment internally, same result)
          const { segment, customers } = await createSegment({
            name: action.segment.name,
            description: action.segment.description,
            filters: action.segment.filters
          });

          // Step 4: Create campaign with REAL predictions, not Gemini's guess
          const campaign = await createCampaign({
            name: action.campaign.name,
            goal: action.campaign.goal,
            segmentId: segment.id,
            message: action.campaign.message,
            channel: action.campaign.channel,
            predictedOpenRate: realPrediction.estimated_open_rate,
            predictedConversions: realPrediction.estimated_conversions,
            createdBy: 'ai'
          });

          // Step 5: Launch
          const dispatched = await launchCampaign(campaign.id, customers);

          // Append real numbers to the reply so the marketer sees ground-truth data
          replyText = `${text}\n\n📊 **Verified against live data:** ${realReach} customers actually match this segment (estimated ${realPrediction.estimated_opens} opens, ${realPrediction.estimated_conversions} conversions at ${realPrediction.estimated_open_rate}% open rate for ${action.campaign.channel}).`;

          metadata = {
            action_executed: true,
            segment_id: segment.id,
            campaign_id: campaign.id,
            customers_reached: dispatched,
            segment_name: segment.name,
            campaign_name: campaign.name,
            prediction: realPrediction
          };
        }

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
      [session_id, replyText, JSON.stringify(metadata)]
    );

    res.json({ reply: replyText, metadata, session_id });

  } catch (err) {
    console.error('Agent chat error:', err.message);
    res.status(500).json({ error: 'Agent error', details: err.message });
  }
});

// GET /api/agent/sessions
router.get('/sessions', async (req, res) => {
  // console.log('🔍 Sessions route hit!');
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (session_id) 
        session_id,
        content as first_message,
        created_at
       FROM agent_conversations
       WHERE role = 'user'
       ORDER BY session_id, created_at ASC`
    );

    // Get latest timestamp per session
    const sessions = await pool.query(
      `SELECT 
        session_id,
        MIN(created_at) FILTER (WHERE role = 'user') as started_at,
        MAX(created_at) as last_activity,
        MIN(content) FILTER (WHERE role = 'user') as first_message
       FROM agent_conversations
       GROUP BY session_id
       ORDER BY last_activity DESC`
    );

    res.json(sessions.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
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