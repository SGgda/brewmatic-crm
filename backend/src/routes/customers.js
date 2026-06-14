const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    let query = 'SELECT * FROM customers';
    const params = [];

    if (search) {
      query += ` WHERE name ILIKE $1 OR email ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY last_order_date DESC NULLS LAST 
               LIMIT $${params.length + 1} 
               OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM customers');

    res.json({
      customers: result.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/stats
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_customers,
        ROUND(AVG(total_spent)::numeric, 2) as avg_spend,
        SUM(total_spent) as total_revenue,
        COUNT(*) FILTER (
          WHERE last_order_date >= NOW() - INTERVAL '30 days'
        ) as active_30d,
        COUNT(*) FILTER (
          WHERE last_order_date < NOW() - INTERVAL '30 days' 
          AND last_order_date >= NOW() - INTERVAL '90 days'
        ) as at_risk,
        COUNT(*) FILTER (
          WHERE last_order_date < NOW() - INTERVAL '90 days'
        ) as lapsed
      FROM customers
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const customer = await pool.query(
      'SELECT * FROM customers WHERE id = $1', 
      [req.params.id]
    );
    if (!customer.rows.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const orders = await pool.query(
      `SELECT * FROM orders 
       WHERE customer_id = $1 
       ORDER BY created_at DESC LIMIT 10`,
      [req.params.id]
    );

    res.json({ ...customer.rows[0], orders: orders.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;