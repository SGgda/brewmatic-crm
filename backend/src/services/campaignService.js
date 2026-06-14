const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");

const CHANNEL_SERVICE_URL =
  process.env.CHANNEL_SERVICE_URL || "http://localhost:3001";
const CRM_CALLBACK_URL =
  process.env.CRM_CALLBACK_URL || "http://localhost:3000";

async function createCampaign({
  name,
  goal,
  segmentId,
  message,
  channel,
  predictedOpenRate,
  predictedConversions,
  createdBy = "ai",
}) {
  const result = await pool.query(
    `INSERT INTO campaigns 
      (name, goal, segment_id, message, channel, 
       predicted_open_rate, predicted_conversions, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      name,
      goal,
      segmentId,
      message,
      channel,
      predictedOpenRate,
      predictedConversions,
      createdBy,
    ],
  );
  return result.rows[0];
}

async function launchCampaign(campaignId, customers) {
  // Mark campaign as running
  await pool.query(
    `UPDATE campaigns SET status = 'running', launched_at = NOW() 
     WHERE id = $1`,
    [campaignId],
  );

  const campaign = await pool.query("SELECT * FROM campaigns WHERE id = $1", [
    campaignId,
  ]);
  const camp = campaign.rows[0];

  const communications = [];

  for (const customer of customers) {
    const commId = uuidv4();
    const externalId = uuidv4();

    await pool.query(
      `INSERT INTO communications 
        (id, campaign_id, customer_id, message, channel, status, external_id)
       VALUES ($1,$2,$3,$4,$5,'sent',$6)`,
      [commId, campaignId, customer.id, camp.message, camp.channel, externalId],
    );

    communications.push({
      external_id: externalId,
      comm_id: commId,
      recipient: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
      message: camp.message,
      channel: camp.channel,
    });
  }

  // Fire and forget — channel service will callback async
  try {
    await axios.post(`${CHANNEL_SERVICE_URL}/send`, {
      campaign_id: campaignId,
      communications,
      callback_url: `${CRM_CALLBACK_URL}/api/webhooks/receipt`,
    });
  } catch (err) {
    console.error("Channel service dispatch error:", err.message);

    // Dispatch failed — mark everything as failed so nothing gets stuck
    await pool.query(
      `UPDATE communications SET status = 'failed' WHERE campaign_id = $1`,
      [campaignId],
    );
    await pool.query(
      `UPDATE campaigns SET status = 'failed', completed_at = NOW() WHERE id = $1`,
      [campaignId],
    );
  }

  return communications.length;
}

async function getCampaignStats(campaignId) {
  const campaign = await pool.query("SELECT * FROM campaigns WHERE id = $1", [
    campaignId,
  ]);
  if (!campaign.rows.length) return null;
  const camp = campaign.rows[0];

  const stats = await pool.query(
    `SELECT 
      COUNT(*) as total_sent,
      COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
      COUNT(*) FILTER (WHERE status = 'opened') as opened,
      COUNT(*) FILTER (WHERE status = 'read') as read,
      COUNT(*) FILTER (WHERE status = 'clicked') as clicked,
      COUNT(*) FILTER (WHERE status = 'converted') as converted,
      COUNT(*) FILTER (WHERE status = 'failed') as failed
     FROM communications WHERE campaign_id = $1`,
    [campaignId],
  );

  const s = stats.rows[0];
  const totalSent = parseInt(s.total_sent) || 0;
  const opened = parseInt(s.opened) || 0;
  const actualOpenRate =
    totalSent > 0 ? ((opened / totalSent) * 100).toFixed(1) : 0;

  return {
    ...camp,
    total_sent: totalSent,
    delivered: parseInt(s.delivered),
    opened,
    read: parseInt(s.read),
    clicked: parseInt(s.clicked),
    converted: parseInt(s.converted),
    failed: parseInt(s.failed),
    actual_open_rate: parseFloat(actualOpenRate),
  };
}

async function getAllCampaigns() {
  const result = await pool.query(
    `SELECT c.*, 
      COUNT(comm.id) as total_sent,
      COUNT(comm.id) FILTER (
        WHERE comm.status IN ('opened','read','clicked','converted')
      ) as engaged
     FROM campaigns c
     LEFT JOIN communications comm ON comm.campaign_id = c.id
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
  );
  return result.rows;
}

module.exports = {
  createCampaign,
  launchCampaign,
  getCampaignStats,
  getAllCampaigns,
};
