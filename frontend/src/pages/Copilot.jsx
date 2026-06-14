import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { sendAgentMessage, getAgentHistory, getSessions } from '../services/api';

function getOrCreateSessionId() {
  let sessionId = localStorage.getItem('brewmatic_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('brewmatic_session_id', sessionId);
  }
  return sessionId;
}

function truncate(str, n) {
  if (!str) return 'New conversation';
  return str.length > n ? str.slice(0, n) + '...' : str;
}

export default function Copilot() {
  const [sessionId, setSessionId] = useState(getOrCreateSessionId);
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Load sessions list
  const loadSessions = () => {
    getSessions()
      .then(res => setSessions(res.data))
      .catch(err => console.error('Sessions error:', err));
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // Load conversation history when sessionId changes
  useEffect(() => {
    setMessages([]);
    getAgentHistory(sessionId)
      .then(res => {
        const history = res.data.map(msg => ({
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata
        }));
        setMessages(history);
      })
      .catch(err => console.error('History error:', err));
  }, [sessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleNewChat = () => {
    const newId = crypto.randomUUID();
    localStorage.setItem('brewmatic_session_id', newId);
    setSessionId(newId);
    setMessages([]);
  };

  const handleSelectSession = (id) => {
    localStorage.setItem('brewmatic_session_id', id);
    setSessionId(id);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendAgentMessage(sessionId, input);
      const assistantMessage = {
        role: 'assistant',
        content: res.data.reply,
        metadata: res.data.metadata
      };
      setMessages(prev => [...prev, assistantMessage]);
      loadSessions(); // refresh sidebar
    } catch (err) {
      console.error('Agent error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Something went wrong. Please try again.',
        metadata: {}
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="copilot-wrapper">
      {/* Sidebar */}
      <div className="sessions-sidebar">
        <button className="new-chat-btn" onClick={handleNewChat}>
          + New Campaign
        </button>
        <div className="sessions-list">
          {sessions.length === 0 && (
            <div className="sessions-empty">No conversations yet</div>
          )}
          {sessions.map(s => (
            <div
              key={s.session_id}
              className={`session-item ${s.session_id === sessionId ? 'active' : ''}`}
              onClick={() => handleSelectSession(s.session_id)}
            >
              <div className="session-title">
                {truncate(s.first_message, 45)}
              </div>
              <div className="session-date">
                {new Date(s.last_activity).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short'
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="copilot-container">
        <div className="messages-area">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="eyebrow">AI Campaign Copilot</div>
              <h2>Tell me who to reach,<br />I'll handle the rest.</h2>
              <p>
                Describe a goal in plain language — segmenting, messaging,
                channel selection and launch all happen right here.
              </p>
              <div className="hint">
                try: "re-engage customers who haven't ordered in 30 days"
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-content">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>

              {msg.metadata?.action_executed && (
                <div className="action-card success">
                  <div className="action-card-header">
                    <span className="action-card-title">Campaign Launched</span>
                    <span className="action-card-stamp">SENT</span>
                  </div>
                  <div className="action-card-body">
                    <div className="row">
                      <span className="label">segment</span>
                      <span className="value">{msg.metadata.segment_name}</span>
                    </div>
                    <div className="row">
                      <span className="label">campaign</span>
                      <span className="value">{msg.metadata.campaign_name}</span>
                    </div>
                    <div className="row">
                      <span className="label">reached</span>
                      <span className="value">{msg.metadata.customers_reached} customers</span>
                    </div>
                    {msg.metadata.prediction && (
                      <>
                        <div className="row">
                          <span className="label">est. opens</span>
                          <span className="value">{msg.metadata.prediction.estimated_opens}</span>
                        </div>
                        <div className="row">
                          <span className="label">est. conversions</span>
                          <span className="value">{msg.metadata.prediction.estimated_conversions}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {msg.metadata?.reason === 'zero_reach' && (
                <div className="action-card warning">
                  <div className="action-card-header">
                    <span className="action-card-title">No Matching Customers</span>
                    <span className="action-card-stamp">VOID</span>
                  </div>
                  <div className="action-card-body">
                    <div className="note">
                      Try widening the criteria — increase the inactivity
                      window or lower the spend threshold.
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="message assistant">
              <div className="message-content typing">Thinking</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell the Copilot your campaign goal..."
            rows={1}
          />
          <button onClick={handleSend} disabled={loading}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}