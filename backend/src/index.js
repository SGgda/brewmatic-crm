require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/customers', require('./routes/customers'));
app.use('/api/segments', require('./routes/segments'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/agent', require('./routes/agent'));



// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'brewmatic-crm-backend', 
    timestamp: new Date() 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 BrewMatic CRM running on port ${PORT}`);
});

module.exports = app;