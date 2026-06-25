-- Black Box D1 Schema
-- Run each statement individually in the Cloudflare D1 console

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT DEFAULT 'text_paste',
  uploaded_by TEXT DEFAULT 'user',
  created_at TEXT NOT NULL,
  raw_text TEXT,
  attachment_key TEXT,
  analysis_id TEXT,
  confidence_score REAL DEFAULT 0,
  status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  name TEXT NOT NULL,
  label TEXT,
  color TEXT DEFAULT '#8b5cf6'
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  speaker_label TEXT,
  content TEXT NOT NULL,
  timestamp TEXT,
  sequence INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  quality_score INTEGER DEFAULT 0,
  escalation_score INTEGER DEFAULT 0,
  validation_score INTEGER DEFAULT 0,
  collaboration_score INTEGER DEFAULT 0,
  topic_drift_score INTEGER DEFAULT 0,
  resolution_probability REAL DEFAULT 0,
  outcome TEXT DEFAULT 'unresolved',
  topics TEXT DEFAULT '[]',
  themes TEXT DEFAULT '[]',
  coaching_recommendations TEXT DEFAULT '[]',
  horsemen_data TEXT DEFAULT '{}',
  repair_data TEXT DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS horsemen_scores (
  id TEXT PRIMARY KEY,
  analysis_id TEXT REFERENCES analysis_runs(id),
  conversation_id TEXT REFERENCES conversations(id),
  horseman TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  speaker_label TEXT,
  excerpt TEXT,
  confidence REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repair_scores (
  id TEXT PRIMARY KEY,
  analysis_id TEXT REFERENCES analysis_runs(id),
  behavior_type TEXT NOT NULL,
  success INTEGER DEFAULT 0,
  speaker_label TEXT,
  excerpt TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  name TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  first_mentioned_at INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  name TEXT NOT NULL,
  confidence REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conflict_outcomes (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  outcome TEXT NOT NULL,
  confidence REAL DEFAULT 0,
  evidence TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coaching_reports (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  draft_text TEXT NOT NULL,
  risk_score INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'low',
  report_data TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS search_index (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  content TEXT NOT NULL,
  keywords TEXT,
  indexed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_analysis_conversation ON analysis_runs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_topics_conversation ON topics(conversation_id);
