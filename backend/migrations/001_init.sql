-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  channel_preference VARCHAR(20) DEFAULT 'email' 
    CHECK (channel_preference IN ('whatsapp', 'sms', 'email', 'rcs')),
  total_spent DECIMAL(10, 2) DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  last_order_date TIMESTAMP,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Segments table
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  customer_count INTEGER DEFAULT 0,
  created_by VARCHAR(20) DEFAULT 'ai',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Segment customers junction table
CREATE TABLE IF NOT EXISTS segment_customers (
  segment_id UUID REFERENCES segments(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  PRIMARY KEY (segment_id, customer_id)
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  goal TEXT,
  segment_id UUID REFERENCES segments(id),
  message TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL 
    CHECK (channel IN ('whatsapp', 'sms', 'email', 'rcs')),
  status VARCHAR(50) DEFAULT 'draft' 
    CHECK (status IN ('draft', 'running', 'completed', 'failed')),
  predicted_open_rate DECIMAL(5, 2),
  predicted_conversions INTEGER,
  created_by VARCHAR(20) DEFAULT 'ai',
  created_at TIMESTAMP DEFAULT NOW(),
  launched_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Communications table (one row per customer per campaign)
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(50) DEFAULT 'sent' 
    CHECK (status IN ('sent','delivered','failed','opened','read','clicked','converted')),
  sent_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  read_at TIMESTAMP,
  clicked_at TIMESTAMP,
  converted_at TIMESTAMP,
  external_id UUID
);

-- Agent conversations table
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_communications_campaign_id ON communications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_communications_external_id ON communications(external_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_session_id ON agent_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_customers_last_order_date ON customers(last_order_date);