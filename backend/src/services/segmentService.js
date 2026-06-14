const pool = require('../config/db');

async function evaluateSegment(filters = {}) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (filters.min_total_spent != null) {
    conditions.push(`total_spent >= $${idx++}`);
    values.push(filters.min_total_spent);
  }
  if (filters.max_total_spent != null) {
    conditions.push(`total_spent <= $${idx++}`);
    values.push(filters.max_total_spent);
  }
  if (filters.min_visit_count != null) {
    conditions.push(`visit_count >= $${idx++}`);
    values.push(filters.min_visit_count);
  }
  if (filters.max_visit_count != null) {
    conditions.push(`visit_count <= $${idx++}`);
    values.push(filters.max_visit_count);
  }
  if (filters.inactive_days_min != null) {
    conditions.push(
      `last_order_date <= NOW() - INTERVAL '${parseInt(filters.inactive_days_min)} days'`
    );
  }
  if (filters.inactive_days_max != null) {
    conditions.push(
      `last_order_date >= NOW() - INTERVAL '${parseInt(filters.inactive_days_max)} days'`
    );
  }
  if (filters.active_days_max != null) {
    conditions.push(
      `last_order_date >= NOW() - INTERVAL '${parseInt(filters.active_days_max)} days'`
    );
  }
  if (filters.channel_preference) {
    conditions.push(`channel_preference = $${idx++}`);
    values.push(filters.channel_preference);
  }
  if (filters.tags && filters.tags.length > 0) {
    conditions.push(`tags && $${idx++}`);
    values.push(filters.tags);
  }

  const where = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}` 
    : '';
  
  const query = `SELECT * FROM customers ${where} 
                 ORDER BY last_order_date DESC`;
  
  const result = await pool.query(query, values);
  return result.rows;
}

async function createSegment({ name, description, filters, createdBy = 'ai' }) {
  const customers = await evaluateSegment(filters);

  const segResult = await pool.query(
    `INSERT INTO segments (name, description, filters, customer_count, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, description, JSON.stringify(filters), customers.length, createdBy]
  );
  const segment = segResult.rows[0];

  if (customers.length > 0) {
    const junctionValues = customers
      .map(c => `('${segment.id}', '${c.id}')`)
      .join(',');
    await pool.query(
      `INSERT INTO segment_customers (segment_id, customer_id) 
       VALUES ${junctionValues} ON CONFLICT DO NOTHING`
    );
  }

  return { segment, customers };
}

async function getSegmentCustomers(segmentId) {
  const result = await pool.query(
    `SELECT c.* FROM customers c
     JOIN segment_customers sc ON sc.customer_id = c.id
     WHERE sc.segment_id = $1`,
    [segmentId]
  );
  return result.rows;
}

module.exports = { evaluateSegment, createSegment, getSegmentCustomers };