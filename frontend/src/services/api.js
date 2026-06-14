import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Agent
export const sendAgentMessage = (sessionId, message) =>
  api.post('/api/agent/chat', { session_id: sessionId, message });

export const getAgentHistory = (sessionId) =>
  api.get(`/api/agent/history/${sessionId}`);

// Campaigns
export const getCampaigns = () =>
  api.get('/api/campaigns');

export const getCampaignStats = (campaignId) =>
  api.get(`/api/campaigns/${campaignId}/stats`);

export const getCampaignInsights = (campaignId) =>
  api.get(`/api/campaigns/${campaignId}/insights`);

// Customers
export const getCustomerStats = () =>
  api.get('/api/customers/stats');

export const getCustomers = (params = {}) =>
  api.get('/api/customers', { params });

export const getSessions = () =>
  api.get('/api/agent/sessions');

export default api;