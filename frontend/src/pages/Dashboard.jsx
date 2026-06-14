import { useState, useEffect } from 'react';
import { getCampaigns, getCustomerStats, getCampaignStats, getCampaignInsights } from '../services/api';

function StatusBadge({ status }) {
  const colors = {
    draft: { bg: '#F0EDE8', color: '#8B7355' },
    running: { bg: '#EBF4FF', color: '#1E6FBF' },
    completed: { bg: '#EAF7ED', color: '#1E5631' },
    failed: { bg: '#FEEEEC', color: '#B6533C' }
  };
  const style = colors[status] || colors.draft;
  return (
    <span className="status-badge" style={style}>
      {status === 'running' && <span className="pulse-dot" />}
      {status}
    </span>
  );
}

function CampaignCard({ campaign, onClick, selected }) {
  return (
    <div
      className={`campaign-card ${selected ? 'selected' : ''}`}
      onClick={() => onClick(campaign)}
    >
      <div className="campaign-card-top">
        <div className="campaign-card-name">{campaign.name}</div>
        <StatusBadge status={campaign.status} />
      </div>
      <div className="campaign-card-meta">
        <span>{campaign.channel?.toUpperCase()}</span>
        <span>{parseInt(campaign.total_sent) || 0} sent</span>
        <span>{parseInt(campaign.engaged) || 0} engaged</span>
      </div>
    </div>
  );
}

function CampaignDetail({ campaignId }) {
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    setStats(null);
    setInsights(null);
    setShowInsights(false);

    const fetchStats = async () => {
      try {
        const res = await getCampaignStats(campaignId);
        setStats(res.data);
      } catch (err) {
        console.error('Stats error:', err);
      }
    };

    fetchStats();

    const interval = setInterval(async () => {
      try {
        const res = await getCampaignStats(campaignId);
        setStats(res.data);
        if (res.data.status === 'completed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [campaignId]);

  const handleGetInsights = async () => {
    setShowInsights(true);
    setLoadingInsights(true);
    try {
      const res = await getCampaignInsights(campaignId);
      setInsights(res.data.insights);
    } catch (err) {
      console.error('Insights error:', err);
    } finally {
      setLoadingInsights(false);
    }
  };

  if (!stats) return <div className="detail-empty">Loading...</div>;

  const openRate = stats.actual_open_rate || 0;
  const predictedRate = parseFloat(stats.predicted_open_rate) || 0;

  return (
    <div className="campaign-detail">
      <div className="detail-header">
        <div>
          <div className="detail-name">{stats.name}</div>
          <div className="detail-goal">{stats.goal}</div>
        </div>
        <StatusBadge status={stats.status} />
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-value">{stats.total_sent}</div>
          <div className="stat-label">Sent</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{stats.delivered}</div>
          <div className="stat-label">Delivered</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{stats.opened}</div>
          <div className="stat-label">Opened</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{stats.clicked}</div>
          <div className="stat-label">Clicked</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{stats.failed}</div>
          <div className="stat-label">Failed</div>
        </div>
        <div className="stat-box highlight">
          <div className="stat-value">{openRate}%</div>
          <div className="stat-label">Actual Open Rate</div>
        </div>
      </div>

      <div className="prediction-comparison">
        <div className="prediction-row">
          <span className="pred-label">Predicted open rate</span>
          <span className="pred-value predicted">{predictedRate}%</span>
        </div>
        <div className="prediction-row">
          <span className="pred-label">Actual open rate</span>
          <span className="pred-value actual">{openRate}%</span>
        </div>
        <div className="prediction-row">
          <span className="pred-label">Predicted conversions</span>
          <span className="pred-value predicted">{stats.predicted_conversions}</span>
        </div>
        <div className="prediction-row">
          <span className="pred-label">Actual conversions</span>
          <span className="pred-value actual">{stats.converted}</span>
        </div>
      </div>

      {stats.status === 'completed' && !showInsights && (
        <button className="insights-btn" onClick={handleGetInsights}>
          ✦ Generate AI Insights
        </button>
      )}

      {loadingInsights && (
        <div className="insights-box loading">
          Generating AI insights...
        </div>
      )}

      {insights && (
        <div className="insights-box">
          <div className="insights-label">✦ AI Insights</div>
          <p>{insights}</p>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [customerStats, setCustomerStats] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  useEffect(() => {
    getCampaigns().then(res => {
      setCampaigns(res.data);
      if (res.data.length > 0) setSelectedCampaign(res.data[0]);
    });
    getCustomerStats().then(res => setCustomerStats(res.data));
  }, []);

  return (
    <div className="dashboard">
      {customerStats && (
        <div className="customer-stats-bar">
          <div className="cstat">
            <span className="cstat-value">{customerStats.total_customers}</span>
            <span className="cstat-label">Total Customers</span>
          </div>
          <div className="cstat">
            <span className="cstat-value">{customerStats.active_30d}</span>
            <span className="cstat-label">Active (30d)</span>
          </div>
          <div className="cstat">
            <span className="cstat-value">{customerStats.at_risk}</span>
            <span className="cstat-label">At Risk</span>
          </div>
          <div className="cstat">
            <span className="cstat-value">{customerStats.lapsed}</span>
            <span className="cstat-label">Lapsed</span>
          </div>
          <div className="cstat">
            <span className="cstat-value">₹{parseFloat(customerStats.total_revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            <span className="cstat-label">Total Revenue</span>
          </div>
        </div>
      )}

      <div className="dashboard-body">
        <div className="campaigns-list">
          <div className="campaigns-list-header">Campaigns</div>
          {campaigns.length === 0 && (
            <div className="detail-empty">No campaigns yet. Launch one from the Copilot.</div>
          )}
          {campaigns.map(c => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onClick={setSelectedCampaign}
              selected={selectedCampaign?.id === c.id}
            />
          ))}
        </div>

        <div className="campaign-detail-panel">
          {selectedCampaign ? (
            <CampaignDetail campaignId={selectedCampaign.id} />
          ) : (
            <div className="detail-empty">Select a campaign to view stats</div>
          )}
        </div>
      </div>
    </div>
  );
}