const express = require('express');
const router = express.Router();
const pool = require('../config/db');

const STATUS_ORDER = [
  'sent', 'delivered', 'opened', 'read', 'clicked', 'converted', 'failed'
];

function isValidTransition(current, next) {
  if (next === 'failed') return true;
  const currentIdx = STATUS_ORDER.indexOf(current);
  const nextIdx = STATUS_ORDER.indexOf(next);
  return nextIdx > currentIdx;
}

// POST /api/webhooks/receipt
router.post('/receipt', async (req, res) => {
  const { external_id, status, timestamp } = req.body;

  if (!external_id || !status) {
    return res.status(400).json({ 
      error: 'external_id and status are required' 
    });
  }

  const validStatuses = [
    'delivered', 'failed', 'opened', 'read', 'clicked', 'converted'
  ];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status: ${status}` });
  }

  // UUID validation BEFORE hitting the DB
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(external_id)) {
    return res.status(400).json({ error: 'Invalid external_id format' });
  }

  try {
    const commResult = await pool.query(
      'SELECT * FROM communications WHERE external_id = $1',
      [external_id]
    );

    if (!commResult.rows.length) {
      return res.status(404).json({ error: 'Communication not found' });
    }

    const comm = commResult.rows[0];

    // Enforce status ordering — no going backward
    if (!isValidTransition(comm.status, status)) {
      return res.status(200).json({
        message: `Ignored: ${comm.status} → ${status} not allowed`,
        skipped: true
      });
    }

    // Map status to timestamp column
    const timestampCol = {
      delivered: 'delivered_at',
      opened: 'opened_at',
      read: 'read_at',
      clicked: 'clicked_at',
      converted: 'converted_at'
    }[status];

    const tsValue = timestamp ? new Date(timestamp) : new Date();

    if (timestampCol) {
      await pool.query(
        `UPDATE communications SET status = $1, ${timestampCol} = $2 
         WHERE external_id = $3`,
        [status, tsValue, external_id]
      );
    } else {
      await pool.query(
        `UPDATE communications SET status = $1 WHERE external_id = $2`,
        [status, external_id]
      );
    }

    // Check if all communications for this campaign are terminal
    const pendingResult = await pool.query(
      `SELECT COUNT(*) as pending FROM communications
       WHERE campaign_id = $1 
       AND status NOT IN 
         ('delivered','failed','opened','read','clicked','converted')`,
      [comm.campaign_id]
    );

    const pending = parseInt(pendingResult.rows[0].pending);
    if (pending === 0) {
      await pool.query(
        `UPDATE campaigns SET status = 'completed', completed_at = NOW() 
         WHERE id = $1 AND status = 'running'`,
        [comm.campaign_id]
      );
    }

    res.json({ success: true, external_id, status });

  } catch (err) {
    console.error('Receipt webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;