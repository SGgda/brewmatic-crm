const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { evaluateSegment } = require('../services/segmentService');

// GET /api/segments
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM segments ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/segments/preview
// Preview how many customers match a filter before saving
router.post('/preview', async (req, res) => {
  try {
    const { filters } = req.body;
    const customers = await evaluateSegment(filters);
    res.json({ 
      count: customers.length, 
      sample: customers.slice(0, 5) 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/segments/:id/customers
router.get('/:id/customers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.* FROM customers c
       JOIN segment_customers sc ON sc.customer_id = c.id
       WHERE sc.segment_id = $1`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;