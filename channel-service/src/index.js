require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Realistic delivery profiles per channel
const CHANNEL_PROFILES = {
  whatsapp: {
    fail_rate: 0.05,
    deliver_delay: [1000, 3000],
    open_rate: 0.65,
    open_delay: [3000, 15000],
    read_rate: 0.55,
    read_delay: [5000, 20000],
    click_rate: 0.08,
    click_delay: [8000, 25000],
  },
  sms: {
    fail_rate: 0.08,
    deliver_delay: [500, 2000],
    open_rate: 0.45,
    open_delay: [2000, 10000],
    read_rate: 0.40,
    read_delay: [3000, 15000],
    click_rate: 0.05,
    click_delay: [5000, 20000],
  },
  email: {
    fail_rate: 0.03,
    deliver_delay: [2000, 5000],
    open_rate: 0.28,
    open_delay: [10000, 30000],
    read_rate: 0.22,
    read_delay: [15000, 40000],
    click_rate: 0.04,
    click_delay: [20000, 60000],
  },
  rcs: {
    fail_rate: 0.06,
    deliver_delay: [1000, 3000],
    open_rate: 0.55,
    open_delay: [3000, 12000],
    read_rate: 0.48,
    read_delay: [5000, 18000],
    click_rate: 0.07,
    click_delay: [8000, 22000],
  }
};

function randomDelay(range) {
  return Math.floor(Math.random() * (range[1] - range[0]) + range[0]);
}

function chance(rate) {
  return Math.random() < rate;
}

async function fireCallback(callbackUrl, payload, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await axios.post(callbackUrl, payload, { timeout: 5000 });
      return;
    } catch (err) {
      console.error(
        `Callback attempt ${attempt} failed for ${payload.external_id}: ${err.message}`
      );
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  console.error(`All ${retries} attempts failed for ${payload.external_id}`);
}

async function simulateCommunication(comm, callbackUrl) {
  const profile = CHANNEL_PROFILES[comm.channel] || CHANNEL_PROFILES.email;

  // Step 1: Fail or deliver
  if (chance(profile.fail_rate)) {
    setTimeout(() => {
      fireCallback(callbackUrl, {
        external_id: comm.external_id,
        status: 'failed',
        timestamp: new Date().toISOString()
      });
    }, randomDelay(profile.deliver_delay));
    return;
  }

  // Delivered
  setTimeout(async () => {
    await fireCallback(callbackUrl, {
      external_id: comm.external_id,
      status: 'delivered',
      timestamp: new Date().toISOString()
    });

    // Step 2: Opened?
    if (!chance(profile.open_rate)) return;
    setTimeout(async () => {
      await fireCallback(callbackUrl, {
        external_id: comm.external_id,
        status: 'opened',
        timestamp: new Date().toISOString()
      });

      // Step 3: Read?
      if (!chance(profile.read_rate)) return;
      setTimeout(async () => {
        await fireCallback(callbackUrl, {
          external_id: comm.external_id,
          status: 'read',
          timestamp: new Date().toISOString()
        });

        // Step 4: Clicked?
        if (!chance(profile.click_rate)) return;
        setTimeout(async () => {
          await fireCallback(callbackUrl, {
            external_id: comm.external_id,
            status: 'clicked',
            timestamp: new Date().toISOString()
          });
        }, randomDelay(profile.click_delay));

      }, randomDelay(profile.read_delay));
    }, randomDelay(profile.open_delay));

  }, randomDelay(profile.deliver_delay));
}

// POST /send
app.post('/send', async (req, res) => {
  const { campaign_id, communications, callback_url } = req.body;

  if (!campaign_id || !communications || !callback_url) {
    return res.status(400).json({ 
      error: 'campaign_id, communications, and callback_url are required' 
    });
  }

  console.log(
    `📨 Received ${communications.length} communications for campaign ${campaign_id}`
  );

  // Acknowledge immediately
  res.json({
    accepted: communications.length,
    campaign_id,
    message: 'Accepted for delivery simulation'
  });

  // Simulate async
  for (const comm of communications) {
    simulateCommunication(comm, callback_url);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'brewmatic-channel-service', 
    timestamp: new Date() 
  });
});
// Keep-alive ping to prevent Render cold starts
const https = require('https');
setInterval(() => {
  https.get('https://brewmatic-channel-service.onrender.com/health', (res) => {
    console.log(`Keep-alive ping: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('Keep-alive error:', err.message);
  });
}, 840000); // every 14 minutes

app.listen(PORT, () => {
  console.log(`📡 BrewMatic Channel Service running on port ${PORT}`);
});